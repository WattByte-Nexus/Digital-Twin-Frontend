import * as React from "react";
import { Rnd } from "react-rnd";
import { cn } from "../lib/utils";
import {
  anchorForPanelPosition,
  constrainPanelGeometry,
  fitScaleForPanel,
  positionForPanelAnchor,
  snapPanelToNearestEdge,
  type FloatingPanelAnchor,
  type FloatingPanelBounds,
  type FloatingPanelGeometry,
  type FloatingPanelPosition,
  type FloatingPanelSize,
} from "./floating-map-panel-geometry";

const DRAG_HANDLE_CLASS_NAME = "floating-map-panel-drag-handle";
const INTERACTIVE_ELEMENT_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [role='slider'], [contenteditable='true']";
const DEFAULT_PANEL_SIZE: FloatingPanelSize = { width: 380, height: 760 };
const DEFAULT_MINIMUM_SIZE: FloatingPanelSize = { width: 320, height: 360 };
const DEFAULT_LAUNCHER_SIZE: FloatingPanelSize = { width: 40, height: 40 };

export type FloatingMapPanelDock =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface FloatingMapPanelProps {
  "aria-label": string;
  children: React.ReactNode;
  className?: string;
  defaultDock?: FloatingMapPanelDock;
  defaultSize?: FloatingPanelSize;
  edgeInset?: number;
  fitToBounds?: boolean;
  minimumSize?: FloatingPanelSize;
  maximumScale?: number;
  onAnchorChange?: (anchor: FloatingPanelAnchor) => void;
  anchor?: FloatingPanelAnchor;
}

export interface FloatingMapLauncherProps {
  children: React.ReactElement;
  className?: string;
  defaultDock?: FloatingMapPanelDock;
  edgeInset?: number;
  hidden?: boolean;
  anchor?: FloatingPanelAnchor;
  onAnchorChange?: (anchor: FloatingPanelAnchor) => void;
  onActivate: () => void;
  size?: FloatingPanelSize;
}

interface FloatingMapPanelContextValue {
  dock: (edge: "bottom" | "left" | "right" | "top") => void;
}

const FloatingMapPanelContext = React.createContext<FloatingMapPanelContextValue | null>(
  null,
);

function positionForDock(
  dock: FloatingMapPanelDock,
  size: FloatingPanelSize,
  bounds: FloatingPanelBounds,
  inset: number,
): FloatingPanelPosition {
  const x = dock.endsWith("right")
    ? Math.max(inset, bounds.width - size.width - inset)
    : inset;
  const y = dock.startsWith("bottom")
    ? Math.max(inset, bounds.height - size.height - inset)
    : inset;
  return { x, y };
}

export function FloatingMapPanel({
  "aria-label": ariaLabel,
  children,
  className,
  defaultDock = "top-right",
  defaultSize = DEFAULT_PANEL_SIZE,
  edgeInset = 16,
  fitToBounds = false,
  maximumScale = 1,
  minimumSize = DEFAULT_MINIMUM_SIZE,
  onAnchorChange,
  anchor,
}: FloatingMapPanelProps) {
  const boundsRef = React.useRef<FloatingPanelBounds>({ width: 0, height: 0 });
  const initializedRef = React.useRef(false);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = React.useState<FloatingPanelGeometry>({
    position: { x: edgeInset, y: edgeInset },
    size: defaultSize,
  });

  React.useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateBounds = () => {
      const bounds = {
        width: overlay.clientWidth,
        height: overlay.clientHeight,
      };
      if (bounds.width <= 0 || bounds.height <= 0) return;
      boundsRef.current = bounds;
      setGeometry((current) => {
        let next = constrainPanelGeometry(
          current,
          bounds,
          minimumSize,
          edgeInset,
        );
        if (fitToBounds) {
          const scale = fitScaleForPanel(
            defaultSize,
            bounds,
            edgeInset,
            maximumScale,
          );
          next = {
            position: next.position,
            size: {
              width: defaultSize.width * scale,
              height: defaultSize.height * scale,
            },
          };
        }
        if (!initializedRef.current) {
          initializedRef.current = true;
          next = {
            ...next,
            position: anchor
              ? positionForPanelAnchor(anchor, next.size, bounds, edgeInset)
              : positionForDock(defaultDock, next.size, bounds, edgeInset),
          };
        } else if (anchor) {
          next = {
            ...next,
            position: positionForPanelAnchor(anchor, next.size, bounds, edgeInset),
          };
        }
        return next.position.x === current.position.x &&
          next.position.y === current.position.y &&
          next.size.width === current.size.width &&
          next.size.height === current.size.height
          ? current
          : next;
      });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [
    anchor,
    defaultDock,
    defaultSize,
    edgeInset,
    fitToBounds,
    maximumScale,
    minimumSize,
  ]);

  const dock = React.useCallback(
    (edge: "bottom" | "left" | "right" | "top") => {
      const bounds = boundsRef.current;
      const maxX = Math.max(edgeInset, bounds.width - geometry.size.width - edgeInset);
      const maxY = Math.max(edgeInset, bounds.height - geometry.size.height - edgeInset);
      const next = {
        ...geometry,
        position: {
          x:
            edge === "left"
              ? edgeInset
              : edge === "right"
                ? maxX
                : geometry.position.x,
          y:
            edge === "top"
              ? edgeInset
              : edge === "bottom"
                ? maxY
                : geometry.position.y,
        },
      };
      setGeometry(next);
      onAnchorChange?.(
        anchorForPanelPosition(next.position, next.size, bounds, edgeInset),
      );
    },
    [edgeInset, geometry, onAnchorChange],
  );

  const availableWidth = Math.max(0, boundsRef.current.width - edgeInset * 2);
  const availableHeight = Math.max(0, boundsRef.current.height - edgeInset * 2);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-slot="floating-map-panel-boundary"
    >
      <FloatingMapPanelContext.Provider value={{ dock }}>
        <Rnd
          aria-label={ariaLabel}
          bounds="parent"
          cancel={INTERACTIVE_ELEMENT_SELECTOR}
          className={cn("pointer-events-auto z-20", className)}
          dragHandleClassName={DRAG_HANDLE_CLASS_NAME}
          enableResizing={false}
          maxHeight={availableHeight || undefined}
          maxWidth={availableWidth || undefined}
          minHeight={Math.min(minimumSize.height, availableHeight || minimumSize.height)}
          minWidth={Math.min(minimumSize.width, availableWidth || minimumSize.width)}
          onDragStop={(_event, data) => {
            const position = snapPanelToNearestEdge(
              { x: data.x, y: data.y },
              geometry.size,
              boundsRef.current,
              edgeInset,
            );
            setGeometry({ ...geometry, position });
            onAnchorChange?.(
              anchorForPanelPosition(
                position,
                geometry.size,
                boundsRef.current,
                edgeInset,
              ),
            );
          }}
          position={geometry.position}
          role="dialog"
          size={geometry.size}
        >
          <div
            className="h-full w-full"
            style={
              fitToBounds
                ? {
                    height: defaultSize.height,
                    transform: `scale(${geometry.size.width / defaultSize.width})`,
                    transformOrigin: "top left",
                    width: defaultSize.width,
                  }
                : undefined
            }
          >
            {children}
          </div>
        </Rnd>
      </FloatingMapPanelContext.Provider>
    </div>
  );
}

export function FloatingMapLauncher({
  children,
  className,
  defaultDock = "top-right",
  edgeInset = 16,
  hidden = false,
  anchor,
  onAnchorChange,
  onActivate,
  size = DEFAULT_LAUNCHER_SIZE,
}: FloatingMapLauncherProps) {
  const boundsRef = React.useRef<FloatingPanelBounds>({ width: 0, height: 0 });
  const draggedRef = React.useRef(false);
  const initializedRef = React.useRef(false);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const suppressActivationRef = React.useRef(false);
  const [position, setPosition] = React.useState<FloatingPanelPosition>({
    x: edgeInset,
    y: edgeInset,
  });

  React.useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const updateBounds = () => {
      const bounds = { width: overlay.clientWidth, height: overlay.clientHeight };
      if (bounds.width <= 0 || bounds.height <= 0) return;
      boundsRef.current = bounds;
      setPosition((current) => {
        const next = anchor
          ? positionForPanelAnchor(anchor, size, bounds, edgeInset)
          : initializedRef.current
          ? constrainPanelGeometry(
              { position: current, size },
              bounds,
              size,
              edgeInset,
            ).position
          : positionForDock(defaultDock, size, bounds, edgeInset);
        initializedRef.current = true;
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [anchor, defaultDock, edgeInset, size]);

  const dock = (edge: "bottom" | "left" | "right" | "top") => {
    const bounds = boundsRef.current;
    const maxX = Math.max(edgeInset, bounds.width - size.width - edgeInset);
    const maxY = Math.max(edgeInset, bounds.height - size.height - edgeInset);
    const next = {
      x: edge === "left" ? edgeInset : edge === "right" ? maxX : position.x,
      y: edge === "top" ? edgeInset : edge === "bottom" ? maxY : position.y,
    };
    setPosition(next);
    onAnchorChange?.(anchorForPanelPosition(next, size, bounds, edgeInset));
  };
  const childProps = children.props as {
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  };

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-slot="floating-map-launcher-boundary"
    >
      <Rnd
        className={cn(
          "pointer-events-auto z-20 flex cursor-move touch-none select-none items-center justify-center",
          hidden && "invisible pointer-events-none",
          className,
        )}
        enableResizing={false}
        bounds="parent"
        onDragStart={() => {
          draggedRef.current = false;
        }}
        onDrag={(_event, data) => {
          if (Math.abs(data.deltaX) + Math.abs(data.deltaY) > 2) draggedRef.current = true;
        }}
        onDragStop={(_event, data) => {
          const next = snapPanelToNearestEdge(
            { x: data.x, y: data.y },
            size,
            boundsRef.current,
            edgeInset,
          );
          setPosition(next);
          onAnchorChange?.(
            anchorForPanelPosition(next, size, boundsRef.current, edgeInset),
          );
          suppressActivationRef.current = draggedRef.current;
          window.setTimeout(() => {
            suppressActivationRef.current = false;
          }, 0);
        }}
        position={position}
        size={size}
      >
        {React.cloneElement(children, {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            if (hidden) return;
            if (suppressActivationRef.current) {
              event.preventDefault();
              return;
            }
            childProps.onClick?.(event);
            if (!event.defaultPrevented) onActivate();
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
            if (hidden) return;
            childProps.onKeyDown?.(event);
            if (event.defaultPrevented) return;
            const edge =
              event.key === "ArrowLeft"
                ? "left"
                : event.key === "ArrowRight"
                  ? "right"
                  : event.key === "ArrowUp"
                    ? "top"
                    : event.key === "ArrowDown"
                      ? "bottom"
                      : null;
            if (!edge) return;
            event.preventDefault();
            dock(edge);
          },
          "aria-hidden": hidden || undefined,
          tabIndex: hidden ? -1 : undefined,
        } as React.HTMLAttributes<HTMLElement>)}
      </Rnd>
    </div>
  );
}

export interface FloatingMapPanelDragHandleProps
  extends React.ComponentPropsWithoutRef<"div"> {
  "aria-label"?: string;
}

export function FloatingMapPanelDragHandle({
  "aria-label": ariaLabel =
    "Move panel. Drag with a pointer or use the arrow keys to dock it to a map edge.",
  className,
  onKeyDown,
  ...props
}: FloatingMapPanelDragHandleProps) {
  const context = React.useContext(FloatingMapPanelContext);
  if (!context) {
    throw new Error("FloatingMapPanelDragHandle must be used inside FloatingMapPanel.");
  }

  return (
    <div
      {...props}
      aria-label={ariaLabel}
      className={cn(
        DRAG_HANDLE_CLASS_NAME,
        "cursor-move touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const edge =
          event.key === "ArrowLeft"
            ? "left"
            : event.key === "ArrowRight"
              ? "right"
              : event.key === "ArrowUp"
                ? "top"
                : event.key === "ArrowDown"
                  ? "bottom"
                  : null;
        if (!edge) return;
        event.preventDefault();
        context.dock(edge);
      }}
      role="toolbar"
      tabIndex={0}
    />
  );
}
