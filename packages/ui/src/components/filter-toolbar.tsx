import { Search, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button, type ButtonProps } from "./button";
import { Input } from "./input";
import { SelectTrigger } from "./select-menu";

function FilterToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-toolbar"
      className={cn("space-y-2.5", className)}
      {...props}
    />
  );
}

function FilterToolbarRow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="filter-toolbar-row"
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

interface FilterSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onValueChange: (value: string) => void;
}

function FilterSearch({
  className,
  onValueChange,
  placeholder = "Search",
  value,
  ...props
}: FilterSearchProps) {
  const searchValue = typeof value === "string" ? value : "";

  return (
    <div
      className={cn("relative min-w-52 flex-1 sm:max-w-72", className)}
      data-slot="filter-search"
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        className="h-8 border-input bg-card pl-8 pr-8 text-xs shadow-none hover:border-foreground/25 focus-visible:border-ring"
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
        {...props}
      />
      {searchValue ? (
        <Button
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 size-5 -translate-y-1/2 rounded-sm p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onValueChange("")}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-3" />
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      className={cn(
        "h-8 min-w-40 border-input bg-card text-xs font-medium shadow-none hover:bg-surface-hover",
        className,
      )}
      size="sm"
      {...props}
    />
  );
}

function FilterButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "h-8 gap-1.5 border-input bg-card px-2.5 text-xs shadow-none hover:bg-surface-hover",
        className,
      )}
      size="sm"
      type="button"
      variant="outline"
      {...props}
    />
  );
}

interface FilterChipProps extends Omit<ButtonProps, "children" | "onClick"> {
  label: string;
  onRemove: () => void;
}

function FilterChip({ className, label, onRemove, ...props }: FilterChipProps) {
  return (
    <Button
      aria-label={`Remove ${label} filter`}
      className={cn(
        "h-7 gap-1 rounded-md border-0 bg-surface-subtle px-2 text-[11px] font-medium text-muted-foreground shadow-none hover:bg-surface-hover hover:text-foreground",
        className,
      )}
      onClick={onRemove}
      size="sm"
      type="button"
      variant="secondary"
      {...props}
    >
      {label}
      <X aria-hidden="true" className="size-3" />
    </Button>
  );
}

export {
  FilterButton,
  FilterChip,
  FilterSearch,
  FilterSelectTrigger,
  FilterToolbar,
  FilterToolbarRow,
};
export type { FilterChipProps, FilterSearchProps };
