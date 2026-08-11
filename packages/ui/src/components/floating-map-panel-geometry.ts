export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export interface FloatingPanelSize {
  width: number;
  height: number;
}

export interface FloatingPanelBounds {
  width: number;
  height: number;
}

export interface FloatingPanelGeometry {
  position: FloatingPanelPosition;
  size: FloatingPanelSize;
}

export type FloatingPanelEdge = "bottom" | "left" | "right" | "top";

export interface FloatingPanelAnchor {
  edge: FloatingPanelEdge;
  offset: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function constrainPanelGeometry(
  geometry: FloatingPanelGeometry,
  bounds: FloatingPanelBounds,
  minimumSize: FloatingPanelSize,
  inset: number,
): FloatingPanelGeometry {
  const availableWidth = Math.max(0, bounds.width - inset * 2);
  const availableHeight = Math.max(0, bounds.height - inset * 2);
  const width = clamp(
    geometry.size.width,
    Math.min(minimumSize.width, availableWidth),
    availableWidth,
  );
  const height = clamp(
    geometry.size.height,
    Math.min(minimumSize.height, availableHeight),
    availableHeight,
  );
  const maxX = Math.max(inset, bounds.width - width - inset);
  const maxY = Math.max(inset, bounds.height - height - inset);

  return {
    position: {
      x: clamp(geometry.position.x, inset, maxX),
      y: clamp(geometry.position.y, inset, maxY),
    },
    size: { width, height },
  };
}

export function snapPanelToNearestEdge(
  position: FloatingPanelPosition,
  size: FloatingPanelSize,
  bounds: FloatingPanelBounds,
  inset: number,
): FloatingPanelPosition {
  const maxX = Math.max(inset, bounds.width - size.width - inset);
  const maxY = Math.max(inset, bounds.height - size.height - inset);
  const x = clamp(position.x, inset, maxX);
  const y = clamp(position.y, inset, maxY);
  const edges = [
    { distance: Math.abs(x - inset), position: { x: inset, y } },
    { distance: Math.abs(maxX - x), position: { x: maxX, y } },
    { distance: Math.abs(y - inset), position: { x, y: inset } },
    { distance: Math.abs(maxY - y), position: { x, y: maxY } },
  ];

  return edges.reduce((nearest, edge) =>
    edge.distance < nearest.distance ? edge : nearest,
  ).position;
}

export function anchorForPanelPosition(
  position: FloatingPanelPosition,
  size: FloatingPanelSize,
  bounds: FloatingPanelBounds,
  inset: number,
): FloatingPanelAnchor {
  const maxX = Math.max(inset, bounds.width - size.width - inset);
  const maxY = Math.max(inset, bounds.height - size.height - inset);
  const x = clamp(position.x, inset, maxX);
  const y = clamp(position.y, inset, maxY);
  const edges = [
    { edge: "left" as const, distance: Math.abs(x - inset) },
    { edge: "right" as const, distance: Math.abs(maxX - x) },
    { edge: "top" as const, distance: Math.abs(y - inset) },
    { edge: "bottom" as const, distance: Math.abs(maxY - y) },
  ];
  const edge = edges.reduce((nearest, candidate) =>
    candidate.distance < nearest.distance ? candidate : nearest,
  ).edge;
  const vertical = edge === "left" || edge === "right";
  const start = vertical ? y : x;
  const end = vertical ? maxY : maxX;

  return {
    edge,
    offset: end === inset ? 0 : clamp((start - inset) / (end - inset), 0, 1),
  };
}

export function positionForPanelAnchor(
  anchor: FloatingPanelAnchor,
  size: FloatingPanelSize,
  bounds: FloatingPanelBounds,
  inset: number,
): FloatingPanelPosition {
  const maxX = Math.max(inset, bounds.width - size.width - inset);
  const maxY = Math.max(inset, bounds.height - size.height - inset);
  const x = inset + (maxX - inset) * clamp(anchor.offset, 0, 1);
  const y = inset + (maxY - inset) * clamp(anchor.offset, 0, 1);

  return {
    x: anchor.edge === "left" ? inset : anchor.edge === "right" ? maxX : x,
    y: anchor.edge === "top" ? inset : anchor.edge === "bottom" ? maxY : y,
  };
}
