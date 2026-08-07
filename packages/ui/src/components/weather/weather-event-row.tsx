import { useEffect, useRef, useState } from "react";
import { Input } from "../input";
import { Label } from "../label";
import { clampWeatherValue } from "./types";

const INTEGER_DRAFT = /^\d*$/;
const DECIMAL_DRAFT = /^\d*(?:\.\d*)?$/;

export interface WeatherEventRowProps {
  label: string;
  maximum?: number;
  onChange: (value: number) => void;
  step?: number;
  unit: string;
  value: number;
}

export function WeatherEventRow({
  label,
  value,
  unit,
  maximum = 100,
  step = 1,
  onChange,
}: WeatherEventRowProps) {
  const id = `weather-${label.toLowerCase().replaceAll(" ", "-")}`;
  const [draft, setDraft] = useState(String(value));
  const editingRef = useRef(false);
  const acceptsDecimal = !Number.isInteger(step);

  useEffect(() => {
    if (!editingRef.current) setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    editingRef.current = false;
    const parsed = draft === "" || draft === "." ? 0 : Number(draft);
    const next = clampWeatherValue(parsed, 0, maximum);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-2">
      <Label className="truncate text-[11px] font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          className="input-compact-number h-8 min-w-0 ps-3 pe-8 text-right tabular-nums"
          type="text"
          inputMode={acceptsDecimal ? "decimal" : "numeric"}
          pattern={acceptsDecimal ? "[0-9]*[.]?[0-9]*" : "[0-9]*"}
          value={draft}
          onFocus={() => {
            editingRef.current = true;
          }}
          onChange={(event) => {
            const raw = event.target.value;
            const validDraft = acceptsDecimal ? DECIMAL_DRAFT.test(raw) : INTEGER_DRAFT.test(raw);
            if (!validDraft) return;

            setDraft(raw);
            if (raw === "" || raw === ".") return;

            const next = Number(raw);
            if (Number.isFinite(next)) onChange(clampWeatherValue(next, 0, maximum));
          }}
          onBlur={commitDraft}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
