import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import * as React from "react";
import { Input } from "../input";
import { Label } from "../label";
import { clampWeatherValue, padWeatherTime } from "./types";

interface CircularTimeSelectorProps {
  disabled?: boolean;
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

export type TimeOfDayPhase = "night" | "sunrise" | "day" | "sunset";

export function getTimeOfDayPhase(
  hour: number,
  minute: number
): TimeOfDayPhase {
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes < 6 * 60 || totalMinutes >= 20 * 60) return "night";
  if (totalMinutes < 8 * 60) return "sunrise";
  if (totalMinutes < 18 * 60) return "day";
  return "sunset";
}

function CircularTimeSelector({
  disabled = false,
  hour,
  minute,
  onChange,
}: CircularTimeSelectorProps) {
  const dialRef = React.useRef<HTMLDivElement>(null);
  const totalMinutes = hour * 60 + minute;
  const angle = (totalMinutes / 1440) * 360;
  const angleRadians = (angle * Math.PI) / 180;
  const handleRadius = 40;
  const phase = getTimeOfDayPhase(hour, minute);
  const TimeIcon =
    phase === "night"
      ? Moon
      : phase === "sunrise"
      ? Sunrise
      : phase === "sunset"
      ? Sunset
      : Sun;

  const setFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = dialRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      const degrees = (Math.atan2(y, x) * 180) / Math.PI + 90;
      const normalized = (degrees + 360) % 360;
      const nextMinutes = Math.round((normalized / 360) * 288) * 5;
      const bounded = nextMinutes % 1440;
      onChange(Math.floor(bounded / 60), bounded % 60);
    },
    [onChange]
  );

  const nudge = (delta: number) => {
    const next = (totalMinutes + delta + 1440) % 1440;
    onChange(Math.floor(next / 60), next % 60);
  };

  return (
    <div
      ref={dialRef}
      className={`relative h-[98px] w-[98px] touch-none rounded-full border bg-muted/35 shadow-inner ${
        disabled ? "cursor-not-allowed opacity-55" : ""
      }`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Time of day"
      aria-valuemin={0}
      aria-valuemax={1439}
      aria-valuenow={totalMinutes}
      aria-valuetext={`${padWeatherTime(hour)}:${padWeatherTime(minute)}`}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (disabled) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          setFromPointer(event);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          nudge(5);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          nudge(-5);
        }
      }}
    >
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-1 w-px origin-[50%_0] bg-border"
          style={{ transform: `rotate(${index * 30}deg) translateY(-44px)` }}
          aria-hidden="true"
        />
      ))}
      <div
        className="absolute left-1/2 top-1/2 h-10 w-px origin-top bg-primary/25"
        style={{ transform: `rotate(${angle + 180}deg)` }}
        aria-hidden="true"
      />
      <span
        className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-background bg-primary shadow-sm active:cursor-grabbing"
        style={{
          left: `calc(50% + ${Math.sin(angleRadians) * handleRadius}px)`,
          top: `calc(50% - ${Math.cos(angleRadians) * handleRadius}px)`,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm"
        data-time-phase={phase}
      >
        <TimeIcon
          className={
            phase === "night"
              ? "h-[17px] w-[17px] text-purple-500 dark:text-purple-400"
              : "h-[17px] w-[17px] text-amber-500"
          }
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export interface TimeOfDayControlProps {
  disabled?: boolean;
  hour: number;
  minute: number;
  onTimeChange: (hour: number, minute: number) => void;
}

export function TimeOfDayControl({
  disabled = false,
  hour,
  minute,
  onTimeChange,
}: TimeOfDayControlProps) {
  return (
    <div className="grid grid-cols-[116px_1fr] items-center gap-4">
      <div className="flex justify-center">
        <CircularTimeSelector
          disabled={disabled}
          hour={hour}
          minute={minute}
          onChange={onTimeChange}
        />
      </div>
      <div className="space-y-2">
        <Label className="relative block">
          <span className="sr-only">Hour</span>
          <Input
            className="input-compact-number pe-10 tabular-nums"
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(event) =>
              onTimeChange(
                clampWeatherValue(Number(event.target.value), 0, 23),
                minute
              )
            }
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            hr
          </span>
        </Label>
        <Label className="relative block">
          <span className="sr-only">Minute</span>
          <Input
            className="input-compact-number pe-10 tabular-nums"
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(event) =>
              onTimeChange(
                hour,
                clampWeatherValue(Number(event.target.value), 0, 59)
              )
            }
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            min
          </span>
        </Label>
      </div>
    </div>
  );
}
