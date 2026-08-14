import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyDigitalTwinPolePositionOverrides,
  type DigitalTwinPowerLineNetwork,
  type DigitalTwinPowerPole,
  type DigitalTwinPowerPoleInteraction,
  type DigitalTwinPoleGesture,
} from "../digital-twin-power-line-rendering";
import {
  beginDigitalTwinPoleDrag,
  DIGITAL_TWIN_POLE_MOVE_INTENT_EVENT,
  selectDigitalTwinPoleIds,
  translateDigitalTwinPoleDrag,
  type DigitalTwinPoleDrag,
  type DigitalTwinPoleMoveIntentDetail,
  type DigitalTwinPolePosition,
} from "../digital-twin-pole-interaction";
import {
  createDigitalTwinMapAssetSelectionDetail,
  DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
} from "./map-asset-selection";

interface SuspendedMapNavigation {
  map: MapLibreMap;
  dragPanEnabled: boolean;
  dragRotateEnabled: boolean;
}

export interface DigitalTwinPoleMapInteractionResult {
  network: DigitalTwinPowerLineNetwork | undefined;
  layerInteraction: DigitalTwinPowerPoleInteraction;
  onSurfaceClick: (event: Event) => void;
  popoverSelection: {
    poleId: string;
    screenPosition: { x: number; y: number };
  } | null;
  clearSelection: () => void;
  stagedMoveCount: number;
}

function hasAdditiveModifier(event: Event): boolean {
  const pointerEvent = event as MouseEvent;
  return Boolean(
    pointerEvent.ctrlKey || pointerEvent.metaKey || pointerEvent.shiftKey
  );
}

function geographicPointer(
  map: MapLibreMap,
  screen: readonly [x: number, y: number]
): [longitude: number, latitude: number] {
  const coordinate = map.unproject([screen[0], screen[1]]);
  return [coordinate.lng, coordinate.lat];
}

function viewportScreenPosition(
  map: MapLibreMap | null,
  screen: readonly [x: number, y: number]
): { x: number; y: number } {
  if (!map) return { x: screen[0], y: screen[1] };
  const bounds = map.getCanvas().getBoundingClientRect();
  return { x: bounds.left + screen[0], y: bounds.top + screen[1] };
}

function terrainElevation(
  map: MapLibreMap,
  longitude: number,
  latitude: number,
  fallbackElevation: number
): number {
  const terrain = map.getTerrain();
  if (!terrain) return fallbackElevation;
  const sampledElevation = map.queryTerrainElevation([longitude, latitude]);
  if (sampledElevation === null || !Number.isFinite(sampledElevation)) {
    return fallbackElevation;
  }
  const exaggeration =
    typeof terrain.exaggeration === "number" && terrain.exaggeration > 0
      ? terrain.exaggeration
      : 1;
  return sampledElevation / exaggeration;
}

function samePosition(
  first: DigitalTwinPolePosition,
  second: DigitalTwinPolePosition
): boolean {
  return first.every((coordinate, index) =>
    Number.isFinite(second[index])
      ? Math.abs(coordinate - second[index]) < 1e-10
      : false
  );
}

export function useDigitalTwinPoleInteraction({
  map,
  network,
  networkKey,
}: {
  map: MapLibreMap | null;
  network: DigitalTwinPowerLineNetwork | undefined;
  networkKey: string;
}): DigitalTwinPoleMapInteractionResult {
  const [hoveredPoleId, setHoveredPoleId] = useState<string | null>(null);
  const [selectedPoleIds, setSelectedPoleIds] = useState<string[]>([]);
  const [popoverSelection, setPopoverSelection] = useState<{
    poleId: string;
    screenPosition: { x: number; y: number };
  } | null>(null);
  const [stagedPositions, setStagedPositions] = useState<
    ReadonlyMap<string, DigitalTwinPolePosition>
  >(() => new Map());
  const [previewPositions, setPreviewPositions] = useState<
    ReadonlyMap<string, DigitalTwinPolePosition> | null
  >(null);
  const dragRef = useRef<DigitalTwinPoleDrag | null>(null);
  const navigationRef = useRef<SuspendedMapNavigation | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const pendingGestureRef = useRef<DigitalTwinPoleGesture | null>(null);
  const suppressClickRef = useRef(false);

  const publishSelection = useCallback((poleIds: readonly string[]) => {
    window.dispatchEvent(
      new CustomEvent(DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT, {
        detail: createDigitalTwinMapAssetSelectionDetail(
          poleIds.length > 0 ? "pole" : null,
          poleIds
        ),
      })
    );
  }, []);

  const restoreNavigation = useCallback(() => {
    const suspended = navigationRef.current;
    if (!suspended) return;
    if (suspended.dragPanEnabled) suspended.map.dragPan.enable();
    if (suspended.dragRotateEnabled) suspended.map.dragRotate.enable();
    navigationRef.current = null;
  }, []);

  const cancelPreviewFrame = useCallback(() => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    pendingGestureRef.current = null;
  }, []);

  const cancelDrag = useCallback(() => {
    cancelPreviewFrame();
    dragRef.current = null;
    setPreviewPositions(null);
    restoreNavigation();
  }, [cancelPreviewFrame, restoreNavigation]);

  const clearSelection = useCallback(() => {
    setSelectedPoleIds([]);
    setPopoverSelection(null);
    publishSelection([]);
  }, [publishSelection]);

  useEffect(() => {
    cancelDrag();
    setHoveredPoleId(null);
    clearSelection();
    setStagedPositions(new Map());
  }, [cancelDrag, clearSelection, networkKey]);

  useEffect(
    () => () => {
      cancelPreviewFrame();
      restoreNavigation();
    },
    [cancelPreviewFrame, restoreNavigation]
  );

  const activePositions = useMemo(() => {
    if (!previewPositions) return stagedPositions;
    const positions = new Map(stagedPositions);
    for (const [poleId, position] of previewPositions) {
      positions.set(poleId, position);
    }
    return positions;
  }, [previewPositions, stagedPositions]);

  const renderNetwork = useMemo(
    () =>
      network
        ? applyDigitalTwinPolePositionOverrides(network, activePositions)
        : undefined,
    [activePositions, network]
  );

  const selectPole = useCallback(
    (pole: DigitalTwinPowerPole, gesture: DigitalTwinPoleGesture) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const selection = selectDigitalTwinPoleIds(
        selectedPoleIds,
        pole.id,
        gesture.additive ? "add" : "replace"
      );
      setSelectedPoleIds(selection);
      setPopoverSelection({
        poleId: pole.id,
        screenPosition: viewportScreenPosition(map, gesture.screen),
      });
      publishSelection(selection);
    },
    [map, publishSelection, selectedPoleIds]
  );

  const previewForGesture = useCallback(
    (gesture: DigitalTwinPoleGesture) => {
      const drag = dragRef.current;
      if (!drag || !map) return null;
      return translateDigitalTwinPoleDrag(
        drag,
        geographicPointer(map, gesture.screen),
        (longitude, latitude, fallbackElevation) =>
          terrainElevation(
            map,
            longitude,
            latitude,
            fallbackElevation
          )
      );
    },
    [map]
  );

  const startDrag = useCallback(
    (pole: DigitalTwinPowerPole, gesture: DigitalTwinPoleGesture) => {
      if (!map || !renderNetwork) return;
      const result = beginDigitalTwinPoleDrag({
        poles: renderNetwork.poles,
        selectedPoleIds,
        grabbedPoleId: pole.id,
        selectionMode: gesture.additive ? "add" : "replace",
        pointerPosition: geographicPointer(map, gesture.screen),
      });
      if (result.drag.poleIds.length === 0) return;

      map.stop();
      navigationRef.current = {
        map,
        dragPanEnabled: map.dragPan.isEnabled(),
        dragRotateEnabled: map.dragRotate.isEnabled(),
      };
      map.dragPan.disable();
      map.dragRotate.disable();
      dragRef.current = result.drag;
      setSelectedPoleIds(result.selectedPoleIds);
      setPopoverSelection({
        poleId: pole.id,
        screenPosition: viewportScreenPosition(map, gesture.screen),
      });
      publishSelection(result.selectedPoleIds);
    },
    [map, publishSelection, renderNetwork, selectedPoleIds]
  );

  const moveDrag = useCallback(
    (_pole: DigitalTwinPowerPole, gesture: DigitalTwinPoleGesture) => {
      pendingGestureRef.current = gesture;
      if (previewFrameRef.current !== null) return;
      previewFrameRef.current = window.requestAnimationFrame(() => {
        previewFrameRef.current = null;
        const pendingGesture = pendingGestureRef.current;
        pendingGestureRef.current = null;
        if (!pendingGesture) return;
        const preview = previewForGesture(pendingGesture);
        if (preview) setPreviewPositions(preview);
      });
    },
    [previewForGesture]
  );

  const finishDrag = useCallback(
    (pole: DigitalTwinPowerPole, gesture: DigitalTwinPoleGesture) => {
      const drag = dragRef.current;
      if (!drag) return;
      cancelPreviewFrame();
      const finalPositions = previewForGesture(gesture);
      dragRef.current = null;
      setPreviewPositions(null);
      restoreNavigation();
      if (!finalPositions) return;

      const changes: Array<
        DigitalTwinPoleMoveIntentDetail["changes"][number]
      > = [];
      for (const poleId of drag.poleIds) {
        const from = drag.originPositions.get(poleId);
        const to = finalPositions.get(poleId);
        if (!from || !to || samePosition(from, to)) continue;
        const connectedAssetIds =
          renderNetwork?.poles.find((candidate) => candidate.id === poleId)
            ?.assetIds ?? [];
        changes.push({ poleId, from, to, connectedAssetIds });
      }
      if (changes.length === 0) return;

      setStagedPositions((current) => {
        const next = new Map(current);
        for (const change of changes) next.set(change.poleId, change.to);
        return next;
      });
      setPopoverSelection({
        poleId: pole.id,
        screenPosition: viewportScreenPosition(map, gesture.screen),
      });
      window.dispatchEvent(
        new CustomEvent<DigitalTwinPoleMoveIntentDetail>(
          DIGITAL_TWIN_POLE_MOVE_INTENT_EVENT,
          { detail: { phase: "staged", changes } }
        )
      );
      suppressClickRef.current = true;
      window.requestAnimationFrame(() => {
        suppressClickRef.current = false;
      });
    },
    [cancelPreviewFrame, map, previewForGesture, renderNetwork, restoreNavigation]
  );

  const onSurfaceClick = useCallback(
    (event: Event) => {
      if (hasAdditiveModifier(event)) return;
      clearSelection();
    },
    [clearSelection]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dragRef.current) {
        event.preventDefault();
        cancelDrag();
        return;
      }
      if (selectedPoleIds.length > 0) {
        clearSelection();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cancelDrag, clearSelection, selectedPoleIds.length]);

  const layerInteraction = useMemo<DigitalTwinPowerPoleInteraction>(
    () => ({
      hoveredPoleId,
      selectedPoleIds: new Set(selectedPoleIds),
      onHover: (pole) => setHoveredPoleId(pole?.id ?? null),
      onSelect: selectPole,
      onDragStart: startDrag,
      onDrag: moveDrag,
      onDragEnd: finishDrag,
    }),
    [
      finishDrag,
      hoveredPoleId,
      moveDrag,
      selectPole,
      selectedPoleIds,
      startDrag,
    ]
  );

  return {
    network: renderNetwork,
    layerInteraction,
    onSurfaceClick,
    popoverSelection,
    clearSelection,
    stagedMoveCount: stagedPositions.size,
  };
}
