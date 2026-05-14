import type { BakeJob } from "../Bake";
import type { UDim2, UiNode } from "../Types";
import { ResolveKind } from "./KindResolver";
import {
  AbsoluteSize,
  CombinedBounds,
  NodeOrigin,
  PositionRelativeTo,
  VisualOrigin,
  VisualPositionRelativeTo,
  VisualSize,
} from "./Sizing";
import { HasAutoLayout, MapAutoLayout, MapAutoPadding } from "./AutoLayout";
import { ScanFills } from "./Fills";
import { MapText } from "./Text";

export type WalkOptions = { LayerNameDetection?: boolean; BakeTextNodes?: boolean; ResponsiveScale?: boolean };
export type WalkStats = { NodeCount: number; ImageCount: number };
export type ReferenceSize = { X: number; Y: number };
export type WalkResult = { Tree: UiNode; Stats: WalkStats; BakeJobs: BakeJob[]; ReferenceFrameSize: ReferenceSize };
type Dims = { Width: number; Height: number } | null;
type WalkContext = { Options: WalkOptions; Stats: WalkStats; BakeJobs: BakeJob[] };

function ToScaleUDim2(Pixel: UDim2, Parent: { Width: number; Height: number }): UDim2 {
  return {
    X: { Scale: Parent.Width > 0 ? Pixel.X.Offset / Parent.Width : 0, Offset: 0 },
    Y: { Scale: Parent.Height > 0 ? Pixel.Y.Offset / Parent.Height : 0, Offset: 0 },
  };
}

function WalkNode(
  Node: SceneNode,
  ParentOrigin: { X: number; Y: number } | null,
  ParentDims: Dims,
  ParentIsScroll: boolean,
  Context: WalkContext,
): UiNode {
  Context.Stats.NodeCount += 1;
  const LayerNameDetection = Context.Options.LayerNameDetection ?? true;
  const BakeTextNodes = Context.Options.BakeTextNodes ?? true;
  const ResponsiveScale = Context.Options.ResponsiveScale ?? true;
  const Origin = NodeOrigin(Node);
  const ResolvedKind = ResolveKind(Node, LayerNameDetection);
  const ForceBakeText = BakeTextNodes && Node.type === "TEXT";
  const Kind = ForceBakeText
    ? (ResolvedKind === "TextButton" ? "ImageButton" : "ImageLabel")
    : ResolvedKind;
  const IsBaked = Kind === "ImageLabel" || Kind === "ImageButton";

  const PixelPosition = IsBaked
    ? VisualPositionRelativeTo(Node, ParentOrigin ?? Origin)
    : PositionRelativeTo(Node, ParentOrigin ?? Origin);
  const PixelSize = IsBaked ? VisualSize(Node) : AbsoluteSize(Node);
  const NodeWidth = PixelSize.X.Offset;
  const NodeHeight = PixelSize.Y.Offset;

  const UseScale = ResponsiveScale && !ParentIsScroll && ParentDims !== null && ParentDims.Width > 0 && ParentDims.Height > 0;

  let Position: UDim2 = UseScale ? ToScaleUDim2(PixelPosition, ParentDims!) : PixelPosition;
  let Size: UDim2 = UseScale ? ToScaleUDim2(PixelSize, ParentDims!) : PixelSize;

  const Out: UiNode = {
    FigmaId: Node.id,
    Name: Node.name,
    Kind,
    Position,
    Size,
  };

  if (Node.visible === false) Out.Visible = false;

  if (!IsBaked && "rotation" in Node && Math.abs((Node as { rotation: number }).rotation) > 0.001) {
    Out.Rotation = -(Node as { rotation: number }).rotation;
    Out.AnchorPoint = { X: 0.5, Y: 0.5 };
    Out.Position = {
      X: { Scale: Position.X.Scale + Size.X.Scale / 2, Offset: Position.X.Offset + Size.X.Offset / 2 },
      Y: { Scale: Position.Y.Scale + Size.Y.Scale / 2, Offset: Position.Y.Offset + Size.Y.Offset / 2 },
    };
  }

  if ("clipsContent" in Node && (Node as { clipsContent: boolean }).clipsContent) {
    Out.ClipsDescendants = true;
  }

  if (!IsBaked && Node.type !== "TEXT") {
    const Fills = ScanFills(Node);
    if (Fills.FirstSolid) Out.BackgroundColor = Fills.FirstSolid;
  }

  if (IsBaked) {
    Context.Stats.ImageCount += 1;
    Context.BakeJobs.push({ FigmaId: Node.id, Name: Node.name, Node });
  }

  const NodeDims: { Width: number; Height: number } | null =
    NodeWidth > 0 && NodeHeight > 0 ? { Width: NodeWidth, Height: NodeHeight } : null;

  if (Node.type === "TEXT" && !ForceBakeText) {
    const TextProps = MapText(Node);
    if (ResponsiveScale) {
      TextProps.TextScaled = true;
    }
    Out.Text = TextProps;
  }

  if (HasAutoLayout(Node)) {
    Out.Layout = MapAutoLayout(Node, ResponsiveScale, NodeDims);
  }

  const Padding = MapAutoPadding(Node, ResponsiveScale, NodeDims);
  if (Padding) Out.Padding = Padding;

  if ("children" in Node && Node.type !== "BOOLEAN_OPERATION") {
    const ChildOrigin = IsBaked ? VisualOrigin(Node) : Origin;
    const ChildIsScroll = Kind === "ScrollingFrame";
    const Children: UiNode[] = [];
    for (const ChildNode of Node.children as readonly SceneNode[]) {
      if (ChildNode.visible === false) continue;
      const Child = WalkNode(ChildNode, ChildOrigin, NodeDims, ChildIsScroll, Context);
      Child.LayoutOrder = Children.length;
      Children.push(Child);
    }
    if (Children.length > 0) Out.Children = Children;
  }

  return Out;
}

const FullScale: UDim2 = { X: { Scale: 1, Offset: 0 }, Y: { Scale: 1, Offset: 0 } };
const Origin0: UDim2 = { X: { Scale: 0, Offset: 0 }, Y: { Scale: 0, Offset: 0 } };
const Centered: UDim2 = { X: { Scale: 0.5, Offset: 0 }, Y: { Scale: 0.5, Offset: 0 } };

export function WalkSelection(Selection: readonly SceneNode[], Options: WalkOptions = {}): WalkResult {
  if (Selection.length === 0) {
    throw new Error("Select a frame, component, or layer to sync.");
  }
  const Stats: WalkStats = { NodeCount: 0, ImageCount: 0 };
  const BakeJobs: BakeJob[] = [];
  const Context: WalkContext = { Options, Stats, BakeJobs };
  const ResponsiveScale = Options.ResponsiveScale ?? true;

  if (Selection.length === 1) {
    const Root = Selection[0]!;
    const RootBox = Root.absoluteBoundingBox;
    const RefX = RootBox?.width ?? Root.width;
    const RefY = RootBox?.height ?? Root.height;
    const Tree = WalkNode(Root, null, null, false, Context);
    Tree.Name = "Root";
    if (ResponsiveScale) {
      Tree.Position = Centered;
      Tree.AnchorPoint = { X: 0.5, Y: 0.5 };
      Tree.Size = FullScale;
    }
    return { Tree, Stats, BakeJobs, ReferenceFrameSize: { X: RefX, Y: RefY } };
  }

  const Bounds = CombinedBounds(Selection);
  const RootDims = { Width: Bounds.Width, Height: Bounds.Height };
  const Tree: UiNode = {
    FigmaId: `synthetic:${Selection.map((N) => N.id).join(",")}`,
    Name: "Root",
    Kind: "Frame",
    Position: ResponsiveScale ? Centered : Origin0,
    AnchorPoint: ResponsiveScale ? { X: 0.5, Y: 0.5 } : undefined,
    Size: ResponsiveScale ? FullScale : { X: { Scale: 0, Offset: Bounds.Width }, Y: { Scale: 0, Offset: Bounds.Height } },
    Children: Selection.map((N, Index) => {
      const Child = WalkNode(N, Bounds.Origin, RootDims, false, Context);
      Child.LayoutOrder = Index;
      return Child;
    }),
  };
  Stats.NodeCount += 1;
  return { Tree, Stats, BakeJobs, ReferenceFrameSize: { X: Bounds.Width, Y: Bounds.Height } };
}
