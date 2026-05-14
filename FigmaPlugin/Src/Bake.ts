export type BakeJob = { FigmaId: string; Name: string; Node: SceneNode };
export type BakeResult = { FigmaId: string; Name: string; Bytes: Uint8Array };

const MinScale = 0.5;
const MaxScale = 4;

export async function BakeAll(
  Jobs: readonly BakeJob[],
  Scale: number,
  OnProgress?: (Done: number, Total: number) => void,
): Promise<BakeResult[]> {
  const Clamped = Math.max(MinScale, Math.min(MaxScale, Scale));
  const Out: BakeResult[] = [];
  const Failed: string[] = [];
  for (let I = 0; I < Jobs.length; I++) {
    const Job = Jobs[I]!;
    try {
      const Bytes = await BakeOne(Job.Node, Clamped);
      if (Failed.length === 0) {
        Out.push({ FigmaId: Job.FigmaId, Name: Job.Name, Bytes });
      }
    } catch (Err) {
      if (Failed.length === 0) Out.length = 0;
      console.warn(`[FigmaToRoblox] Bake failed for "${Job.Name}":`, Err);
      Failed.push(`${Job.Name}: ${(Err as Error).message ?? String(Err)}`);
    }
    OnProgress?.(I + 1, Jobs.length);
  }
  if (Failed.length > 0) {
    const Detail = Failed.slice(0, 3).join("; ");
    const More = Failed.length > 3 ? ` (+${Failed.length - 3} more)` : "";
    throw new Error(`${Failed.length} image bake${Failed.length === 1 ? "" : "s"} failed: ${Detail}${More}`);
  }
  return Out;
}

async function BakeOne(Node: SceneNode, Scale: number): Promise<Uint8Array> {
  const Restore = HideChildren(Node);
  try {
    return await (Node as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: Scale },
      contentsOnly: true,
    });
  } finally {
    Restore();
  }
}

const Noop = () => {};

// Hide direct children before exportAsync so the bake captures only the parent's
// own visuals. BOOLEAN_OPERATION children are the visual, so leave them visible.
function HideChildren(Node: SceneNode): () => void {
  if (!("children" in Node)) return Noop;
  if (Node.type === "BOOLEAN_OPERATION") return Noop;
  const Saved: SceneNode[] = [];
  for (const Child of Node.children) {
    if (!Child.visible) continue;
    try {
      Child.visible = false;
      Saved.push(Child);
    } catch {
      // Some node types refuse mutation; bake them as-is.
    }
  }
  if (Saved.length === 0) return Noop;
  return () => {
    for (const Child of Saved) {
      try {
        Child.visible = true;
      } catch {
        // best-effort restore
      }
    }
  };
}
