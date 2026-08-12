import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export type SortDirection = "asc" | "desc";

export interface SortableTableHeaderProps {
  active: boolean;
  children: ReactNode;
  direction: SortDirection;
  onClick: () => void;
}

export function SortableTableHeader({
  active,
  children,
  direction,
  onClick,
}: SortableTableHeaderProps) {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <Button
      className="-ms-3 h-8 gap-1.5 px-3 text-xs"
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      {children}
      {active ? <Icon aria-hidden="true" className="size-3.5" /> : null}
    </Button>
  );
}
