import type { LayoutProps, PaddingProps, UDim } from "../Types";

type AutoLayoutMode = "HORIZONTAL" | "VERTICAL";
type PrimaryAlign = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
type CounterAlign = "MIN" | "CENTER" | "MAX" | "BASELINE";

type AutoLayoutNode = SceneNode & {
  layoutMode: AutoLayoutMode | "NONE";
  itemSpacing: number;
  primaryAxisAlignItems: PrimaryAlign;
  counterAxisAlignItems: CounterAlign;
};

function ToHorizontal(V: PrimaryAlign | CounterAlign): "Left" | "Center" | "Right" {
  if (V === "CENTER") return "Center";
  if (V === "MAX") return "Right";
  return "Left";
}

function ToVertical(V: PrimaryAlign | CounterAlign): "Top" | "Center" | "Bottom" {
  if (V === "CENTER") return "Center";
  if (V === "MAX") return "Bottom";
  return "Top";
}

export function HasAutoLayout(Node: SceneNode): Node is AutoLayoutNode {
  return "layoutMode" in Node && (Node as { layoutMode: string }).layoutMode !== "NONE";
}

function PaddingUDim(Px: number, ParentExtent: number, Responsive: boolean): UDim {
  if (Responsive && ParentExtent > 0) {
    return { Scale: Px / ParentExtent, Offset: 0 };
  }
  return { Scale: 0, Offset: Px };
}

export function MapAutoLayout(Node: AutoLayoutNode, ResponsiveScale: boolean, NodeDims: { Width: number; Height: number } | null): LayoutProps {
  const FillDirection: "Horizontal" | "Vertical" = Node.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical";
  const Out: LayoutProps = { Type: "List", FillDirection };
  if (typeof Node.itemSpacing === "number" && Node.itemSpacing !== 0) {
    const Extent = FillDirection === "Horizontal" ? (NodeDims?.Width ?? 0) : (NodeDims?.Height ?? 0);
    Out.Padding = PaddingUDim(Math.round(Node.itemSpacing), Extent, ResponsiveScale);
  }
  const IsSpaceBetween = Node.primaryAxisAlignItems === "SPACE_BETWEEN";
  if (IsSpaceBetween) {
    Out.Flex = "SpaceBetween";
  }
  if (FillDirection === "Horizontal") {
    Out.HorizontalAlignment = IsSpaceBetween ? "Left" : ToHorizontal(Node.primaryAxisAlignItems);
    Out.VerticalAlignment = ToVertical(Node.counterAxisAlignItems);
  } else {
    Out.VerticalAlignment = IsSpaceBetween ? "Top" : ToVertical(Node.primaryAxisAlignItems);
    Out.HorizontalAlignment = ToHorizontal(Node.counterAxisAlignItems);
  }
  return Out;
}

export function MapAutoPadding(Node: SceneNode, ResponsiveScale: boolean, NodeDims: { Width: number; Height: number } | null): PaddingProps | null {
  if (!("paddingTop" in Node)) return null;
  const Padded = Node as SceneNode & { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
  const T = Math.round(Padded.paddingTop ?? 0);
  const B = Math.round(Padded.paddingBottom ?? 0);
  const L = Math.round(Padded.paddingLeft ?? 0);
  const R = Math.round(Padded.paddingRight ?? 0);
  if (T === 0 && B === 0 && L === 0 && R === 0) return null;
  const W = NodeDims?.Width ?? 0;
  const H = NodeDims?.Height ?? 0;
  return {
    Top: PaddingUDim(T, H, ResponsiveScale),
    Bottom: PaddingUDim(B, H, ResponsiveScale),
    Left: PaddingUDim(L, W, ResponsiveScale),
    Right: PaddingUDim(R, W, ResponsiveScale),
  };
}
