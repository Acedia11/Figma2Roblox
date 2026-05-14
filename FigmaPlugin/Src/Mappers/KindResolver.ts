import type { UiNodeKind } from "../Types";

const ButtonNamePattern = /\b(button|btn|cta)\b/i;
const ScrollNamePattern = /\bscroll/i;

function HasReactions(Node: SceneNode): boolean {
  if (!("reactions" in Node)) return false;
  const Reactions = (Node as { reactions: ReadonlyArray<unknown> }).reactions;
  return Array.isArray(Reactions) && Reactions.length > 0;
}

export function ResolveKind(Node: SceneNode, LayerNameDetection: boolean): UiNodeKind {
  const NameLooksClickable = LayerNameDetection && ButtonNamePattern.test(Node.name);
  const Clickable = HasReactions(Node) || NameLooksClickable;

  if (Node.type === "TEXT") {
    return Clickable ? "TextButton" : "TextLabel";
  }

  if (
    Node.type === "FRAME" ||
    Node.type === "COMPONENT" ||
    Node.type === "COMPONENT_SET" ||
    Node.type === "INSTANCE" ||
    Node.type === "GROUP" ||
    Node.type === "SECTION"
  ) {
    const ClipsContent = "clipsContent" in Node && (Node as { clipsContent: boolean }).clipsContent === true;
    if (LayerNameDetection && ClipsContent && ScrollNamePattern.test(Node.name)) return "ScrollingFrame";
  }

  return Clickable ? "ImageButton" : "ImageLabel";
}
