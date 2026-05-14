export type FixtureCase = {
  Name: string;
  SelectionIds: string[];
  Options?: {
    BakeTextNodes?: boolean;
    LayerNameDetection?: boolean;
    ResponsiveScale?: boolean;
  };
  ExportScale?: number;
  Visual?: boolean;
  Preview?: {
    Width: number;
    Height: number;
    Background?: string;
  };
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FixtureScene = {
  Nodes: FixtureSceneNode[];
};

export type FixtureSceneNode = {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  visible?: boolean;
  absoluteBoundingBox?: Rect;
  absoluteRenderBounds?: Rect | null;
  fills?: unknown;
  clipsContent?: boolean;
  children?: FixtureSceneNode[];
  exportAsset?: string;
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  itemSpacing?: number;
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  reactions?: unknown[];
  characters?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: { unit: "PIXELS" | "PERCENT"; value: number };
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  textCase?: string;
  textDecoration?: string;
  styledTextSegments?: FixtureTextSegment[];
};

export type FixtureTextSegment = {
  characters: string;
  fontName: { family: string; style: string };
  fontSize: number;
  fontWeight?: number;
  textCase?: string;
  textDecoration?: string;
  fills: unknown;
};

export type LoadedFixtureCase = FixtureCase & {
  Directory: string;
};
