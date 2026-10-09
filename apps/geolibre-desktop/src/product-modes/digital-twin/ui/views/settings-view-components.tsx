import { cn } from "@geolibre/ui";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const RESIZE_STEP = 8;

export function ResizeSeparator({
  className,
  defaultValue,
  edge,
  label,
  max,
  min,
  onChange,
  value,
}: {
  className?: string;
  defaultValue: number;
  edge: "inline-start" | "inline-end";
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  function widthDeltaForPhysicalDelta(element: HTMLElement, physicalDelta: number) {
    const direction = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    return physicalDelta * (edge === "inline-start" ? direction : -direction);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    event.preventDefault();
    const separator = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startValue = value;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = widthDeltaForPhysicalDelta(separator, moveEvent.clientX - startX);
      onChange(clamp(Math.round(startValue + delta), min, max));
    };
    const removeListeners = () => {
      separator.removeEventListener("pointermove", handlePointerMove);
      separator.removeEventListener("pointerup", finishResize);
      separator.removeEventListener("pointercancel", finishResize);
      separator.removeEventListener("lostpointercapture", removeListeners);
    };
    const finishResize = () => {
      removeListeners();
      if (separator.hasPointerCapture(pointerId)) separator.releasePointerCapture(pointerId);
    };

    separator.addEventListener("pointermove", handlePointerMove);
    separator.addEventListener("pointerup", finishResize);
    separator.addEventListener("pointercancel", finishResize);
    separator.addEventListener("lostpointercapture", removeListeners);
    separator.setPointerCapture(pointerId);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(max);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const physicalDelta = event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
    onChange(
      clamp(value + widthDeltaForPhysicalDelta(event.currentTarget, physicalDelta), min, max),
    );
  }

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      className={cn("dt-settings-resizer", className)}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}
