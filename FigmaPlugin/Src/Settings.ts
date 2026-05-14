import type { Settings } from "./Types";

const SettingsKey = "FigmaToRoblox.Settings";

export const DefaultSettings: Settings = {
  BakeTextNodes: true,
  ExportScale: 2,
  LayerNameDetection: true,
  ResponsiveScale: true,
};

export async function LoadSettings(): Promise<Settings> {
  const Stored = await figma.clientStorage.getAsync(SettingsKey);
  if (Stored && typeof Stored === "object") {
    return { ...DefaultSettings, ...(Stored as Settings) };
  }
  return { ...DefaultSettings };
}

export async function StoreSettings(S: Settings): Promise<void> {
  await figma.clientStorage.setAsync(SettingsKey, S);
}
