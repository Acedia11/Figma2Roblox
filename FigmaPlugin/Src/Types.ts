export type UDim = { Scale: number; Offset: number };
export type UDim2 = { X: UDim; Y: UDim };
export type Color = { R: number; G: number; B: number; A?: number };

export type UiNodeKind =
  | "Frame"
  | "ScrollingFrame"
  | "ImageLabel"
  | "ImageButton"
  | "TextLabel"
  | "TextButton"
  | "TextBox";

export type FontFaceProps = {
  Family: string;
  Weight?: string;
  Style?: "Normal" | "Italic";
};

export type TextProps = {
  Text?: string;
  Font?: string;
  FontFace?: FontFaceProps;
  TextSize?: number;
  TextColor?: Color;
  TextXAlignment?: "Left" | "Center" | "Right";
  TextYAlignment?: "Top" | "Center" | "Bottom";
  TextWrapped?: boolean;
  RichText?: boolean;
  LineHeight?: number;
  TextScaled?: boolean;
  TextStrokeColor?: Color;
  TextStrokeTransparency?: number;
  AutomaticSize?: "None" | "X" | "Y" | "XY";
};

export type LayoutProps = {
  Type?: "Grid" | "List";
  FillDirection?: "Horizontal" | "Vertical";
  HorizontalAlignment?: "Left" | "Center" | "Right";
  VerticalAlignment?: "Top" | "Center" | "Bottom";
  Padding?: UDim;
  SortOrder?: "Name" | "LayoutOrder";
  CellSize?: UDim2;
  CellPadding?: UDim2;
  StartCorner?: "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight";
  Flex?: "None" | "Fill" | "SpaceAround" | "SpaceBetween" | "SpaceEvenly";
};

export type PaddingProps = {
  Top?: UDim;
  Bottom?: UDim;
  Left?: UDim;
  Right?: UDim;
};

export type UiNode = {
  FigmaId: string;
  Name?: string;
  Kind: UiNodeKind;
  Position?: UDim2;
  Size?: UDim2;
  AnchorPoint?: { X: number; Y: number };
  Rotation?: number;
  ZIndex?: number;
  LayoutOrder?: number;
  Visible?: boolean;
  ClipsDescendants?: boolean;
  BackgroundColor?: Color;
  ImageHash?: string;
  Text?: TextProps;
  Layout?: LayoutProps;
  Padding?: PaddingProps;
  Children?: UiNode[];
};

export type Settings = {
  AddUIAspectRatioConstraint?: boolean;
  AutoDetectButtons?: boolean;
  ReferenceFrameSize?: { X: number; Y: number };
  BakeTextNodes?: boolean;
  ExportScale?: number;
  LayerNameDetection?: boolean;
  ResponsiveScale?: boolean;
};

export type AssetEntry = { DecalId?: number; ImageId?: number };

export type WorkerPayload = {
  Tree: UiNode;
  Assets?: Record<string, AssetEntry>;
  Settings?: Settings;
};

export type AuthBundle = {
  AccessToken: string;
  RefreshToken: string;
  ExpiresAt: number;
  RobloxUserId: string;
  UserName: string;
};

export type LoadAuthHandler = {
  name: "LOAD_AUTH";
  handler: () => void;
};
export type AuthLoadedHandler = {
  name: "AUTH_LOADED";
  handler: (Bundle: AuthBundle | null) => void;
};
export type StoreAuthHandler = {
  name: "STORE_AUTH";
  handler: (Bundle: AuthBundle) => void;
};
export type AuthStoredHandler = {
  name: "AUTH_STORED";
  handler: () => void;
};
export type ClearAuthHandler = {
  name: "CLEAR_AUTH";
  handler: () => void;
};
export type AuthClearedHandler = {
  name: "AUTH_CLEARED";
  handler: () => void;
};
export type OpenExternalHandler = {
  name: "OPEN_EXTERNAL";
  handler: (Url: string) => void;
};
export type BuildPayloadOptions = { BakeTextNodes?: boolean; ExportScale?: number; LayerNameDetection?: boolean; ResponsiveScale?: boolean };
export type BuildPayloadHandler = {
  name: "BUILD_PAYLOAD";
  handler: (Options?: BuildPayloadOptions) => void;
};
export type LoadSettingsHandler = {
  name: "LOAD_SETTINGS";
  handler: () => void;
};
export type SettingsLoadedHandler = {
  name: "SETTINGS_LOADED";
  handler: (S: Settings) => void;
};
export type StoreSettingsHandler = {
  name: "STORE_SETTINGS";
  handler: (S: Settings) => void;
};
export type SettingsStoredHandler = {
  name: "SETTINGS_STORED";
  handler: () => void;
};
export type BakeBlob = { FigmaId: string; Name: string; Bytes: Uint8Array };
export type PayloadBuiltHandler = {
  name: "PAYLOAD_BUILT";
  handler: (Result: { Tree: UiNode; Bakes: BakeBlob[]; NodeCount: number; ImageCount: number; ReferenceFrameSize: { X: number; Y: number } }) => void;
};
export type PayloadErrorHandler = {
  name: "PAYLOAD_ERROR";
  handler: (Message: string) => void;
};
export type BakeProgressHandler = {
  name: "BAKE_PROGRESS";
  handler: (Progress: { Done: number; Total: number }) => void;
};
export type LoadCacheHandler = {
  name: "LOAD_CACHE";
  handler: () => void;
};
export type CacheLoadedHandler = {
  name: "CACHE_LOADED";
  handler: (Cache: Record<string, AssetEntry>) => void;
};
export type StoreCacheHandler = {
  name: "STORE_CACHE";
  handler: (Cache: Record<string, AssetEntry>) => void;
};
export type CacheStoredHandler = {
  name: "CACHE_STORED";
  handler: () => void;
};
export type SelectionChangedHandler = {
  name: "SELECTION_CHANGED";
  handler: (Info: { Count: number; FirstName: string | null }) => void;
};
export type NotifyHandler = {
  name: "NOTIFY";
  handler: (Message: string) => void;
};
