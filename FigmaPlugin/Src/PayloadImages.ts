import { HashBytes } from "./Hash";
import type { AssetEntry, BakeBlob, UiNode } from "./Types";

export type PayloadImagePlan = {
  FigmaIdToHash: Record<string, string>;
  HashToBytes: Record<string, Uint8Array>;
  HashToName: Record<string, string>;
  UniqueHashes: string[];
  UniqueHashCount: number;
  MissingHashes: string[];
};

export function PlanPayloadImages(Bakes: readonly BakeBlob[], ClientCache: Record<string, AssetEntry>): PayloadImagePlan {
  const FigmaIdToHash: Record<string, string> = {};
  const HashToBytes: Record<string, Uint8Array> = {};
  const HashToName: Record<string, string> = {};

  for (const Bake of Bakes) {
    const Hash = HashBytes(Bake.Bytes);
    FigmaIdToHash[Bake.FigmaId] = Hash;
    if (!HashToBytes[Hash]) {
      HashToBytes[Hash] = Bake.Bytes;
      HashToName[Hash] = Bake.Name;
    }
  }

  const UniqueHashes = Object.keys(HashToBytes);

  return {
    FigmaIdToHash,
    HashToBytes,
    HashToName,
    UniqueHashes,
    UniqueHashCount: UniqueHashes.length,
    MissingHashes: UniqueHashes.filter((Hash) => !ClientCache[Hash]),
  };
}

export function ApplyPayloadImageHashes(Node: UiNode, FigmaIdToHash: Record<string, string>): void {
  const Hash = FigmaIdToHash[Node.FigmaId];
  if (Hash) Node.ImageHash = Hash;
  if (Node.Children) {
    for (const Child of Node.Children) ApplyPayloadImageHashes(Child, FigmaIdToHash);
  }
}

export function CollectPayloadAssets(
  UniqueHashes: readonly string[],
  Cache: Record<string, AssetEntry>,
): Record<string, AssetEntry> {
  const Assets: Record<string, AssetEntry> = {};
  for (const Hash of UniqueHashes) {
    const Entry = Cache[Hash];
    if (Entry) Assets[Hash] = Entry;
  }
  return Assets;
}
