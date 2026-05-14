import type { Color } from "../Types";

export type FillsInfo = { FirstSolid?: Color };

export function ColorFromFirstSolidFill(Fills: ReadonlyArray<Paint> | symbol): Color | undefined {
  if (!Array.isArray(Fills)) return undefined;
  for (const Fill of Fills) {
    if (Fill.visible === false) continue;
    if (Fill.type === "SOLID") {
      return {
        R: Fill.color.r,
        G: Fill.color.g,
        B: Fill.color.b,
        A: Fill.opacity ?? 1,
      };
    }
  }
  return undefined;
}

export function ScanFills(Node: SceneNode): FillsInfo {
  if (!("fills" in Node)) return {};
  const Fills = (Node as { fills: ReadonlyArray<Paint> | symbol }).fills;
  const FirstSolid = ColorFromFirstSolidFill(Fills);
  return FirstSolid ? { FirstSolid } : {};
}
