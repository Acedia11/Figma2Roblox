import type { UDim2 } from "../Types";

export type AbsoluteOrigin = { X: number; Y: number };

export function AbsoluteSize(Node: SceneNode): UDim2 {
  return {
    X: { Scale: 0, Offset: Math.round(Node.width) },
    Y: { Scale: 0, Offset: Math.round(Node.height) },
  };
}

export function BoundingBoxSize(Node: SceneNode): UDim2 {
  const Box = Node.absoluteBoundingBox;
  if (!Box) return AbsoluteSize(Node);
  return {
    X: { Scale: 0, Offset: Math.round(Box.width) },
    Y: { Scale: 0, Offset: Math.round(Box.height) },
  };
}

type RectLike = { x: number; y: number; width: number; height: number };

function RenderRect(Node: SceneNode): RectLike | null {
  const Render = (Node as { absoluteRenderBounds?: RectLike | null }).absoluteRenderBounds;
  if (!Render) return null;
  if (!Number.isFinite(Render.width) || !Number.isFinite(Render.height) || Render.width <= 0 || Render.height <= 0) {
    return null;
  }
  return Render;
}

export function VisualSize(Node: SceneNode): UDim2 {
  const R = RenderRect(Node);
  if (!R) return BoundingBoxSize(Node);
  return {
    X: { Scale: 0, Offset: Math.round(R.width) },
    Y: { Scale: 0, Offset: Math.round(R.height) },
  };
}

export function VisualPositionRelativeTo(Node: SceneNode, ParentOrigin: AbsoluteOrigin | null): UDim2 {
  const R = RenderRect(Node);
  if (!R || !ParentOrigin) return PositionRelativeTo(Node, ParentOrigin);
  return {
    X: { Scale: 0, Offset: Math.round(R.x - ParentOrigin.X) },
    Y: { Scale: 0, Offset: Math.round(R.y - ParentOrigin.Y) },
  };
}

export function VisualOrigin(Node: SceneNode): AbsoluteOrigin | null {
  const R = RenderRect(Node);
  if (R) return { X: R.x, Y: R.y };
  return NodeOrigin(Node);
}

export function PositionRelativeTo(Node: SceneNode, ParentOrigin: AbsoluteOrigin | null): UDim2 {
  const Box = Node.absoluteBoundingBox;
  if (!Box || !ParentOrigin) {
    return { X: { Scale: 0, Offset: 0 }, Y: { Scale: 0, Offset: 0 } };
  }
  return {
    X: { Scale: 0, Offset: Math.round(Box.x - ParentOrigin.X) },
    Y: { Scale: 0, Offset: Math.round(Box.y - ParentOrigin.Y) },
  };
}

export function NodeOrigin(Node: SceneNode): AbsoluteOrigin | null {
  const Box = Node.absoluteBoundingBox;
  if (!Box) return null;
  return { X: Box.x, Y: Box.y };
}

export function CombinedBounds(Selection: readonly SceneNode[]): { Origin: AbsoluteOrigin; Width: number; Height: number } {
  let MinX = Infinity;
  let MinY = Infinity;
  let MaxX = -Infinity;
  let MaxY = -Infinity;
  for (const N of Selection) {
    const B = N.absoluteBoundingBox;
    if (!B) continue;
    if (B.x < MinX) MinX = B.x;
    if (B.y < MinY) MinY = B.y;
    if (B.x + B.width > MaxX) MaxX = B.x + B.width;
    if (B.y + B.height > MaxY) MaxY = B.y + B.height;
  }
  if (!isFinite(MinX) || !isFinite(MinY)) {
    return { Origin: { X: 0, Y: 0 }, Width: 0, Height: 0 };
  }
  return {
    Origin: { X: MinX, Y: MinY },
    Width: Math.round(MaxX - MinX),
    Height: Math.round(MaxY - MinY),
  };
}
