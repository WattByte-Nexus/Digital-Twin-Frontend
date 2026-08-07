import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../lib/utils";

export interface DatePickerProps {
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  theme?: "light" | "dark";
  value: string;
}

export function DatePicker({
  className,
  disabled,
  onChange,
  theme = "light",
  value,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-full justify-between px-3 text-[13px] font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
          aria-label="Choose date"
        >
          {selected ? format(selected, "EEEE d MMMM") : "Choose date"}
          <CalendarDays className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", theme === "dark" && "dark")} align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(next) => {
            if (!next) return;
            onChange(format(next, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
