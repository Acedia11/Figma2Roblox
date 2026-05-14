import { RefreshIfExpired } from "./Auth";
import { NonRetryableAssetUploadError, UploadImage, type UploadDiagnosticsCache } from "./OpenCloud";
import { ApplyPayloadImageHashes, CollectPayloadAssets, PlanPayloadImages } from "./PayloadImages";
import { MapPool } from "./Pool";
import { WorkerFetch } from "./Worker";
import type { AssetEntry, AuthBundle, BakeBlob, Settings, UiNode } from "./Types";

const UploadConcurrency = 2;

export type FailedAsset = { Name: string; Message: string };
export type SkippedAsset = FailedAsset;

export type PushOutcome = {
  Sequence: number;
  Bundle: AuthBundle;
  UpdatedCache: Record<string, AssetEntry>;
  UploadCount: number;
  CacheHitCount: number;
  SkippedAssets: SkippedAsset[];
};

export type PushInput = {
  Bundle: AuthBundle;
  Tree: UiNode;
  Bakes: readonly BakeBlob[];
  ClientCache: Record<string, AssetEntry>;
  OnUploadProgress: (Done: number, Total: number) => void;
  OnUploadRetry?: (Name: string, WaitSeconds: number, Reason: string) => void;
  OnBundleRefreshed?: (Refreshed: AuthBundle) => Promise<void> | void;
  PluginSettings?: Settings;
};

export class AssetUploadBatchError extends Error {
  readonly FailedAssets: FailedAsset[];
  readonly UpdatedCache: Record<string, AssetEntry>;

  constructor(FailedAssets: FailedAsset[], UpdatedCache: Record<string, AssetEntry>) {
    super(FormatUploadBatchError(FailedAssets));
    this.name = "AssetUploadBatchError";
    Object.setPrototypeOf(this, AssetUploadBatchError.prototype);
    this.FailedAssets = FailedAssets;
    this.UpdatedCache = UpdatedCache;
  }
}

export async function PushPayload(Input: PushInput): Promise<PushOutcome> {
  const { Bundle, Tree, Bakes, ClientCache, OnUploadProgress, OnUploadRetry, OnBundleRefreshed, PluginSettings } = Input;
  const Refreshed = await RefreshIfExpired(Bundle);
  if (Refreshed !== Bundle && OnBundleRefreshed) {
    await OnBundleRefreshed(Refreshed);
  }

  const ImagePlan = PlanPayloadImages(Bakes, ClientCache);
  const { FigmaIdToHash, HashToBytes, HashToName, UniqueHashes, UniqueHashCount, MissingHashes } = ImagePlan;
  const Total = MissingHashes.length;
  let Done = 0;
  OnUploadProgress(Done, Total);

  const NewEntries: Record<string, AssetEntry> = {};
  const FailedAssets: FailedAsset[] = [];
  const SkippedAssets: SkippedAsset[] = [];
  const DiagnosticsCache: UploadDiagnosticsCache = {};
  let UploadCount = 0;
  if (Total > 0) {
    await MapPool(MissingHashes, UploadConcurrency, async (Hash) => {
      const Name = HashToName[Hash] ?? "FigmaBake";
      try {
        const Result = await UploadImage(
          Refreshed.AccessToken,
          Refreshed.RobloxUserId,
          HashToBytes[Hash]!,
          Name,
          {
            DiagnosticsCache,
            OnRetry: (Sec, Reason) => OnUploadRetry?.(Name, Sec, Reason),
          },
        );
        NewEntries[Hash] = Result;
        UploadCount += 1;
      } catch (Err) {
        const Issue = { Name, Message: (Err as Error).message ?? String(Err) };
        if (Err instanceof NonRetryableAssetUploadError) {
          SkippedAssets.push(Issue);
        } else {
          FailedAssets.push(Issue);
        }
      }
      Done += 1;
      OnUploadProgress(Done, Total);
    });
  }

  const UpdatedCache: Record<string, AssetEntry> = UploadCount > 0 ? { ...ClientCache, ...NewEntries } : ClientCache;
  if (FailedAssets.length > 0) {
    FailedAssets.sort((A, B) => A.Name.localeCompare(B.Name));
    throw new AssetUploadBatchError(FailedAssets, UpdatedCache);
  }
  SkippedAssets.sort((A, B) => A.Name.localeCompare(B.Name));
  ApplyPayloadImageHashes(Tree, FigmaIdToHash);
  const Assets = CollectPayloadAssets(UniqueHashes, UpdatedCache);

  const Path = `/Pair/${encodeURIComponent(Refreshed.RobloxUserId)}/Push`;
  const Body = JSON.stringify({
    Tree,
    Assets,
    Settings: PluginSettings ?? { AutoDetectButtons: true },
  });
  const Response = await WorkerFetch<{ Sequence?: number }>(Path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Refreshed.AccessToken}`,
    },
    body: Body,
  });
  if (!Response.Ok) throw new Error(Response.Error);
  if (typeof Response.Data?.Sequence !== "number") throw new Error("Worker push returned no Sequence");

  return {
    Sequence: Response.Data.Sequence,
    Bundle: Refreshed,
    UpdatedCache,
    UploadCount,
    CacheHitCount: UniqueHashCount - Total,
    SkippedAssets,
  };
}

export function FormatSkippedAssetsWarning(SkippedAssets: readonly SkippedAsset[]): string {
  return FormatAssetIssueMessage(
    SkippedAssets,
    "skipped because Roblox rejected the upload. The sync was pushed with Studio placeholders for those images.",
    "skipped",
  );
}

function FormatUploadBatchError(FailedAssets: FailedAsset[]): string {
  return FormatAssetIssueMessage(
    FailedAssets,
    "failed after automatic retries. Sync was not pushed to Roblox, so the existing Studio UI was left untouched.",
    "failure",
  );
}

function FormatAssetIssueMessage(Issues: readonly FailedAsset[], Status: string, ExampleLabel: string): string {
  const Count = Issues.length;
  const First = Issues[0];
  const Detail = First ? ` Example ${ExampleLabel}: ${First.Name}: ${TrimMessage(First.Message)}` : "";
  return `${Count} image asset${Count === 1 ? "" : "s"} ${Status}${Detail}`;
}

function TrimMessage(Message: string): string {
  return Message.length > 220 ? `${Message.slice(0, 220)}...` : Message;
}
