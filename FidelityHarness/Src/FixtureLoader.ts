import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { FixtureCase, FixtureScene, FixtureSceneNode, LoadedFixtureCase } from "./Types";

const HarnessRoot = path.resolve(__dirname, "..");
const FixturesRoot = path.join(HarnessRoot, "Fixtures");

export function LoadFixtureCases(): LoadedFixtureCase[] {
  const Entries = fs.readdirSync(FixturesRoot, { withFileTypes: true });
  const Cases: LoadedFixtureCase[] = [];
  for (const Entry of Entries) {
    if (!Entry.isDirectory()) continue;
    const Directory = path.join(FixturesRoot, Entry.name);
    const Case = JSON.parse(fs.readFileSync(path.join(Directory, "Case.json"), "utf8")) as FixtureCase;
    Cases.push({ ...Case, Directory });
  }
  return Cases.sort((A, B) => A.Name.localeCompare(B.Name));
}

export function LoadFixtureScene(Case: LoadedFixtureCase): FixtureScene {
  return JSON.parse(fs.readFileSync(path.join(Case.Directory, "Scene.json"), "utf8")) as FixtureScene;
}

export function CreateSelection(Scene: FixtureScene, Case: LoadedFixtureCase): SceneNode[] {
  const Roots = Scene.Nodes.map((Node) => CreateSceneNode(Node, Case.Directory));
  const ById = new Map<string, SceneNode>();
  for (const Root of Roots) IndexNode(Root, ById);

  return Case.SelectionIds.map((Id) => {
    const Node = ById.get(Id);
    if (!Node) throw new Error(`Fixture "${Case.Name}" references missing selection id "${Id}"`);
    return Node;
  });
}

function IndexNode(Node: SceneNode, ById: Map<string, SceneNode>): void {
  ById.set(Node.id, Node);
  if ("children" in Node) {
    for (const Child of Node.children as readonly SceneNode[]) {
      IndexNode(Child, ById);
    }
  }
}

function TextDefaults(Node: FixtureSceneNode) {
  const FontSize = Node.fontSize ?? 14;
  return {
    characters: Node.characters ?? "",
    fontName: Node.fontName ?? { family: "Inter", style: "Regular" },
    fontSize: FontSize,
    fontWeight: Node.fontWeight ?? 400,
    fills: Node.fills ?? [],
    lineHeight: Node.lineHeight ?? { unit: "PIXELS" as const, value: FontSize },
    textAlignHorizontal: Node.textAlignHorizontal ?? "LEFT",
    textAlignVertical: Node.textAlignVertical ?? "TOP",
    textAutoResize: Node.textAutoResize ?? "NONE",
    textCase: Node.textCase ?? "ORIGINAL",
    textDecoration: Node.textDecoration ?? "NONE",
  };
}

function CreateSceneNode(Node: FixtureSceneNode, FixtureDirectory: string): SceneNode {
  const { children, exportAsset, styledTextSegments, ...SceneFields } = Node;
  const Out: Record<string, unknown> = {
    ...SceneFields,
    visible: Node.visible ?? true,
    fills: Node.fills ?? [],
    layoutMode: Node.layoutMode ?? "NONE",
    itemSpacing: Node.itemSpacing ?? 0,
    primaryAxisAlignItems: Node.primaryAxisAlignItems ?? "MIN",
    counterAxisAlignItems: Node.counterAxisAlignItems ?? "MIN",
    paddingTop: Node.paddingTop ?? 0,
    paddingBottom: Node.paddingBottom ?? 0,
    paddingLeft: Node.paddingLeft ?? 0,
    paddingRight: Node.paddingRight ?? 0,
    reactions: Node.reactions ?? [],
  };

  if (children) {
    Out.children = children.map((Child) => CreateSceneNode(Child, FixtureDirectory));
  }

  if (Node.type === "TEXT") {
    const Defaults = TextDefaults(Node);
    Object.assign(Out, Defaults);
    Out.getStyledTextSegments = () => {
      return (styledTextSegments ?? [
        {
          characters: Defaults.characters,
          fontName: Defaults.fontName,
          fontSize: Defaults.fontSize,
          fontWeight: Defaults.fontWeight,
          textCase: Defaults.textCase,
          textDecoration: Defaults.textDecoration,
          fills: Defaults.fills,
        },
      ]).map((Segment) => ({
        ...Segment,
        fontWeight: Segment.fontWeight ?? 400,
        textCase: Segment.textCase ?? "ORIGINAL",
        textDecoration: Segment.textDecoration ?? "NONE",
      }));
    };
  }

  if (exportAsset) {
    const AssetPath = path.join(FixtureDirectory, exportAsset);
    Out.exportAsync = async () => new Uint8Array(await fsPromises.readFile(AssetPath));
  }

  return Out as unknown as SceneNode;
}
