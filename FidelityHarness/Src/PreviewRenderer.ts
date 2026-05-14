import type { UiNode } from "../../FigmaPlugin/Src/Types";

type PreviewOptions = {
  Width: number;
  Height: number;
  Background?: string;
  AssetsByHash: Record<string, string>;
};

type Size = { Width: number; Height: number };
type Style = Record<string, string | number | undefined>;

export function RenderPreviewHtml(Tree: UiNode, Options: PreviewOptions): string {
  const StageSize = { Width: Options.Width, Height: Options.Height };
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${Options.Background ?? "#ffffff"}; }
  #Stage {
    position: relative;
    width: ${Options.Width}px;
    height: ${Options.Height}px;
    overflow: hidden;
    background: ${Options.Background ?? "#ffffff"};
    font-family: Arial, sans-serif;
  }
</style>
</head>
<body>
<div id="Stage">${RenderNode(Tree, StageSize, Options.AssetsByHash, false)}</div>
</body>
</html>`;
}

function RenderNode(Node: UiNode, ParentSize: Size, AssetsByHash: Record<string, string>, ParentUsesLayout: boolean): string {
  const SizeValue = ResolveSize(Node.Size, ParentSize);
  const Position = ResolvePosition(Node.Position, ParentSize);
  const AnchorX = Node.AnchorPoint?.X ?? 0;
  const AnchorY = Node.AnchorPoint?.Y ?? 0;
  const UsesLayout = !!Node.Layout;
  const Style: Style = {
    position: ParentUsesLayout ? "relative" : "absolute",
    left: ParentUsesLayout ? undefined : `${Position.X - SizeValue.Width * AnchorX}px`,
    top: ParentUsesLayout ? undefined : `${Position.Y - SizeValue.Height * AnchorY}px`,
    width: `${SizeValue.Width}px`,
    height: `${SizeValue.Height}px`,
    order: ParentUsesLayout ? Node.LayoutOrder ?? 0 : undefined,
    overflow: Node.ClipsDescendants || Node.Kind === "ScrollingFrame" ? "hidden" : "visible",
    display: Node.Visible === false ? "none" : UsesLayout ? "flex" : "block",
    transform: Node.Rotation ? `rotate(${Node.Rotation}deg)` : undefined,
    zIndex: Node.ZIndex ?? undefined,
    backgroundColor: Node.BackgroundColor ? ToCssColor(Node.BackgroundColor) : undefined,
  };

  if ((Node.Kind === "ImageLabel" || Node.Kind === "ImageButton") && Node.ImageHash && AssetsByHash[Node.ImageHash]) {
    Style.backgroundImage = `url("${AssetsByHash[Node.ImageHash]}")`;
    Style.backgroundSize = "100% 100%";
    Style.backgroundRepeat = "no-repeat";
  }

  if (UsesLayout) {
    ApplyLayoutStyles(Style, Node, SizeValue);
  }

  const Children = Node.Children
    ? Node.Children.map((Child) => RenderNode(Child, SizeValue, AssetsByHash, UsesLayout)).join("")
    : "";
  const Text = Node.Text ? RenderText(Node) : "";
  return `<div data-figma-id="${EscapeAttr(Node.FigmaId)}" data-kind="${EscapeAttr(Node.Kind)}" style="${StyleToString(Style)}">${Text}${Children}</div>`;
}

function ResolveSize(Value: UiNode["Size"], Parent: Size): Size {
  return {
    Width: ResolveUDim(Value?.X, Parent.Width),
    Height: ResolveUDim(Value?.Y, Parent.Height),
  };
}

function ResolvePosition(Value: UiNode["Position"], Parent: Size): { X: number; Y: number } {
  return {
    X: ResolveUDim(Value?.X, Parent.Width),
    Y: ResolveUDim(Value?.Y, Parent.Height),
  };
}

function ResolveUDim(Value: { Scale: number; Offset: number } | undefined, ParentExtent: number): number {
  if (!Value) return 0;
  return Value.Scale * ParentExtent + Value.Offset;
}

function ApplyLayoutStyles(Style: Style, Node: UiNode, SizeValue: Size): void {
  const Layout = Node.Layout;
  if (!Layout) return;
  const Horizontal = Layout.FillDirection === "Horizontal";
  Style.flexDirection = Horizontal ? "row" : "column";
  Style.gap = Layout.Padding ? `${ResolveUDim(Layout.Padding, Horizontal ? SizeValue.Width : SizeValue.Height)}px` : undefined;
  Style.justifyContent = Layout.Flex === "SpaceBetween" ? "space-between" : MainAlignment(Node);
  Style.alignItems = CrossAlignment(Node);
  if (Node.Padding) {
    Style.paddingTop = `${ResolveUDim(Node.Padding.Top, SizeValue.Height)}px`;
    Style.paddingBottom = `${ResolveUDim(Node.Padding.Bottom, SizeValue.Height)}px`;
    Style.paddingLeft = `${ResolveUDim(Node.Padding.Left, SizeValue.Width)}px`;
    Style.paddingRight = `${ResolveUDim(Node.Padding.Right, SizeValue.Width)}px`;
  }
}

function MainAlignment(Node: UiNode): string {
  if (!Node.Layout) return "flex-start";
  const Value = Node.Layout.FillDirection === "Horizontal" ? Node.Layout.HorizontalAlignment : Node.Layout.VerticalAlignment;
  return FlexAlignment(Value);
}

function CrossAlignment(Node: UiNode): string {
  if (!Node.Layout) return "stretch";
  const Value = Node.Layout.FillDirection === "Horizontal" ? Node.Layout.VerticalAlignment : Node.Layout.HorizontalAlignment;
  return FlexAlignment(Value);
}

function FlexAlignment(Value: string | undefined): string {
  if (Value === "Center") return "center";
  if (Value === "Right" || Value === "Bottom") return "flex-end";
  return "flex-start";
}

function RenderText(Node: UiNode): string {
  const Text = Node.Text;
  if (!Text) return "";
  const TextStyle: Style = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: FlexAlignment(Text.TextYAlignment),
    justifyContent: FlexAlignment(Text.TextXAlignment),
    fontSize: `${Text.TextSize ?? 14}px`,
    color: Text.TextColor ? ToCssColor(Text.TextColor) : "rgb(235, 235, 235)",
    whiteSpace: Text.TextWrapped === false ? "pre" : "pre-wrap",
    lineHeight: Text.LineHeight ? String(Text.LineHeight) : undefined,
    textAlign: (Text.TextXAlignment ?? "Left").toLowerCase(),
  };
  return `<div style="${StyleToString(TextStyle)}">${EscapeHtml(Text.Text ?? "")}</div>`;
}

function ToCssColor(Color: { R: number; G: number; B: number; A?: number }): string {
  const R = Math.round(Color.R * 255);
  const G = Math.round(Color.G * 255);
  const B = Math.round(Color.B * 255);
  return `rgba(${R}, ${G}, ${B}, ${Color.A ?? 1})`;
}

function StyleToString(Style: Style): string {
  return Object.entries(Style)
    .filter((Entry): Entry is [string, string | number] => Entry[1] !== undefined)
    .map(([Key, Value]) => `${ToKebab(Key)}: ${Value}`)
    .join("; ");
}

function ToKebab(Key: string): string {
  return Key.replace(/[A-Z]/g, (Match) => `-${Match.toLowerCase()}`);
}

function EscapeAttr(Value: string): string {
  return EscapeHtml(Value).replace(/"/g, "&quot;");
}

function EscapeHtml(Value: string): string {
  return Value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
