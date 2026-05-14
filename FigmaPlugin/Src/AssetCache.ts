import type { AssetEntry } from "./Types";

const Key = "FigmaToRoblox.AssetCache.v2";

export async function LoadCache(): Promise<Record<string, AssetEntry>> {
  const Raw = await figma.clientStorage.getAsync(Key);
  if (!Raw || typeof Raw !== "object" || Array.isArray(Raw)) return {};
  const Cache: Record<string, AssetEntry> = {};
  for (const [Hash, Value] of Object.entries(Raw)) {
    const Entry = ParseEntry(Value);
    if (Hash && Entry) Cache[Hash] = Entry;
  }
  return Cache;
}

export async function StoreCache(Cache: Record<string, AssetEntry>): Promise<void> {
  await figma.clientStorage.setAsync(Key, Cache);
}

function ParseEntry(Value: unknown): AssetEntry | null {
  if (!Value || typeof Value !== "object" || Array.isArray(Value)) return null;
  const Raw = Value as Partial<AssetEntry>;
  if (typeof Raw.DecalId !== "number" && typeof Raw.ImageId !== "number") return null;
  const Entry: AssetEntry = {};
  if (typeof Raw.DecalId === "number" && Number.isFinite(Raw.DecalId)) Entry.DecalId = Raw.DecalId;
  if (typeof Raw.ImageId === "number" && Number.isFinite(Raw.ImageId)) Entry.ImageId = Raw.ImageId;
  return Entry.DecalId || Entry.ImageId ? Entry : null;
}
