import type { Map as MapLibreMap } from "maplibre-gl";
import { type RefObject, useCallback, useEffect, useRef } from "react";

interface PersistentDigitalTwinMapHostProps {
  contentEl: HTMLElement;
  mapRef: RefObject<MapLibreMap | null>;
  onActivate: () => void;
  parkingHostRef: RefObject<HTMLDivElement | null>;
}

export function PersistentDigitalTwinMapHost({
  contentEl,
  mapRef,
  onActivate,
  parkingHostRef,
}: PersistentDigitalTwinMapHostProps) {
  const resumeFrameRef = useRef<number | null>(null);

  const setHost = useCallback(
    (host: HTMLDivElement | null) => {
      if (resumeFrameRef.current !== null) {
        window.cancelAnimationFrame(resumeFrameRef.current);
        resumeFrameRef.current = null;
      }

      if (!host) {
        const currentHost = contentEl.parentElement;
        const parkingHost = parkingHostRef.current;
        mapRef.current?.stop();
        if (!currentHost || !parkingHost || currentHost === parkingHost) return;

        const { height, width } = currentHost.getBoundingClientRect();
        if (height > 0 && width > 0) {
          parkingHost.style.height = `${height}px`;
          parkingHost.style.width = `${width}px`;
        }
        parkingHost.replaceChildren(contentEl);
        return;
      }

      onActivate();
      host.replaceChildren(contentEl);
      resumeFrameRef.current = window.requestAnimationFrame(() => {
        resumeFrameRef.current = null;
        if (!host.isConnected || host.clientHeight === 0 || host.clientWidth === 0) return;
        mapRef.current?.resize();
        mapRef.current?.triggerRepaint();
      });
    },
    [contentEl, mapRef, onActivate, parkingHostRef],
  );

  useEffect(
    () => () => {
      if (resumeFrameRef.current !== null) {
        window.cancelAnimationFrame(resumeFrameRef.current);
      }
    },
    [],
  );

  return (
    <div
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden"
      data-persistent-digital-twin-map-host=""
      ref={setHost}
    />
  );
}
