import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DigitalTwinTreeAsset } from "../../../lib/digital-twin-assets";
import type {
  DigitalTwinPowerPole,
  DigitalTwinPowerPoleInteraction,
  DigitalTwinPoleGesture,
} from "../digital-twin-power-line-rendering";
import type { DigitalTwinTreeInteraction } from "../digital-twin-tree-rendering";
import { selectDigitalTwinPoleIds } from "../digital-twin-pole-interaction";
import {
  createDigitalTwinMapAssetSelectionDetail,
  DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
  type DigitalTwinMapAssetSelectionDetail,
} from "./map-asset-selection";

export function useDigitalTwinAssetInteraction({
  map,
  regionId,
  treesEnabled,
}: {
  map: MapLibreMap | null;
  regionId: string;
  treesEnabled: boolean;
}) {
  const [hoveredPoleId, setHoveredPoleId] = useState<string | null>(null);
  const [selection, setSelection] =
    useState<DigitalTwinMapAssetSelectionDetail>(() =>
      createDigitalTwinMapAssetSelectionDetail(null, [])
    );
  const [screenPosition, setScreenPosition] = useState({ x: 0, y: 0 });

  const publishSelection = useCallback(
    (next: DigitalTwinMapAssetSelectionDetail) => {
      setSelection(next);
      window.dispatchEvent(
        new CustomEvent(DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT, {
          detail: next,
        })
      );
    },
    []
  );
  const clearSelection = useCallback(() => {
    publishSelection(createDigitalTwinMapAssetSelectionDetail(null, []));
  }, [publishSelection]);

  useEffect(() => {
    setHoveredPoleId(null);
    clearSelection();
  }, [clearSelection, regionId]);

  useEffect(() => {
    if (!treesEnabled && selection.kind === "tree") clearSelection();
  }, [clearSelection, selection.kind, treesEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const positionPopover = useCallback(
    (screen: readonly [number, number]) => {
      const bounds = map?.getCanvas().getBoundingClientRect();
      setScreenPosition(
        bounds
          ? { x: bounds.right - 12, y: bounds.top + 12 }
          : { x: screen[0], y: screen[1] }
      );
    },
    [map]
  );

  const selectPole = useCallback(
    (pole: DigitalTwinPowerPole, gesture: DigitalTwinPoleGesture) => {
      const ids = selectDigitalTwinPoleIds(
        selection.kind === "pole" ? selection.assetIds : [],
        pole.id,
        gesture.additive ? "add" : "replace"
      );
      positionPopover(gesture.screen);
      publishSelection({
        ...createDigitalTwinMapAssetSelectionDetail("pole", ids),
        primaryAssetId: pole.id,
      });
    },
    [positionPopover, publishSelection, selection]
  );

  const selectTree = useCallback(
    (tree: DigitalTwinTreeAsset, screen: [number, number]) => {
      positionPopover(screen);
      publishSelection(
        createDigitalTwinMapAssetSelectionDetail("tree", [tree.assetId])
      );
    },
    [positionPopover, publishSelection]
  );

  const onSurfaceClick = useCallback(
    (event: Event) => {
      const pointer = event as MouseEvent;
      if (pointer.ctrlKey || pointer.metaKey || pointer.shiftKey) return;
      clearSelection();
    },
    [clearSelection]
  );

  const poleInteraction = useMemo<DigitalTwinPowerPoleInteraction>(
    () => ({
      hoveredPoleId,
      selectedPoleIds: new Set(
        selection.kind === "pole" ? selection.assetIds : []
      ),
      onHover: (pole) => setHoveredPoleId(pole?.id ?? null),
      onSelect: selectPole,
    }),
    [hoveredPoleId, selection, selectPole]
  );

  const treeInteraction = useMemo<DigitalTwinTreeInteraction>(
    () => ({
      selectedTreeId:
        selection.kind === "tree" ? selection.primaryAssetId : null,
      onSelect: selectTree,
    }),
    [selection, selectTree]
  );

  return {
    selection,
    screenPosition,
    poleInteraction,
    treeInteraction,
    onSurfaceClick,
    clearSelection,
  };
}
