import { WorkerRawFetch } from "./Worker";

export type UploadResult = { DecalId?: number; ImageId?: number };
type AssetType = "Image" | "Decal";
type TokenResourceInfo = {
  owner?: { id?: string; type?: string };
  resources?: { creator?: { ids?: string[] } };
};
type TokenIntrospection = {
  active?: boolean;
  scope?: string;
  client_id?: string;
  sub?: string;
};
export type UploadDiagnosticsCache = { TokenDiagnostics?: Promise<string | null> };

const PollMaxMs = 120_000;
const PollIntervalMs = 1500;
const FetchMaxAttempts = 5;
const RetryMaxSeconds = 60;

export type UploadOptions = {
  OnRetry?: (WaitSeconds: number, Reason: string) => void;
  DiagnosticsCache?: UploadDiagnosticsCache;
};
type FetchRetryOptions = {
  OnRetry?: (WaitSeconds: number, Reason: string) => void;
  DeadlineMs?: number;
};

export class NonRetryableAssetUploadError extends Error {
  constructor(Message: string) {
    super(Message);
    this.name = "NonRetryableAssetUploadError";
    Object.setPrototypeOf(this, NonRetryableAssetUploadError.prototype);
  }
}

export async function UploadImage(
  AccessToken: string,
  RobloxUserId: string,
  Bytes: Uint8Array,
  DisplayName: string,
  Options: UploadOptions = {},
): Promise<UploadResult> {
  try {
    const ImageId = await CreateAsset(AccessToken, RobloxUserId, Bytes, DisplayName, "Image", Options);
    return { ImageId };
  } catch (Err) {
    if (!ShouldFallbackToDecal(Err)) throw Err;
    const DecalId = await CreateAsset(AccessToken, RobloxUserId, Bytes, DisplayName, "Decal", Options);
    return { DecalId };
  }
}

async function CreateAsset(
  AccessToken: string,
  RobloxUserId: string,
  Bytes: Uint8Array,
  DisplayName: string,
  AssetType: AssetType,
  Options: UploadOptions,
): Promise<number> {
  const Form = new FormData();
  Form.append("request", JSON.stringify({
    assetType: AssetType,
    displayName: SanitizeName(DisplayName),
    description: "FigmaToRoblox bake",
    creationContext: { creator: { userId: ParseUserId(RobloxUserId) } },
  }));
  Form.append("fileContent", new Blob([Bytes as BlobPart], { type: "image/png" }), "bake.png");

  const Resp = await FetchWithRetry("/Assets/Upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${AccessToken}` },
    body: Form,
  }, { OnRetry: Options.OnRetry });
  if (!Resp.ok) {
    const Body = await ReadShort(Resp);
    const Diagnostics = await ReadTokenDiagnostics(AccessToken, Resp.status, Body, Options.DiagnosticsCache);
    const Message = UploadErrorMessage(Resp.status, Body, AssetType, Diagnostics);
    if (IsNonRetryableUploadRejection(Resp.status, Body)) throw new NonRetryableAssetUploadError(Message);
    throw new Error(Message);
  }
  const Json = (await Resp.json()) as { path?: string };
  if (!Json.path) throw new Error("Upload returned no operation path");
  const OpId = Json.path.replace(/^operations\//, "");

  const DeadlineMs = Date.now() + PollMaxMs;
  while (Date.now() < DeadlineMs) {
    const WaitMs = Math.min(PollIntervalMs, Math.max(0, DeadlineMs - Date.now()));
    if (WaitMs > 0) await Sleep(WaitMs);
    if (Date.now() >= DeadlineMs) break;
    const PollResp = await FetchWithRetry(`/Assets/Operation/${encodeURIComponent(OpId)}`, {
      headers: { Authorization: `Bearer ${AccessToken}` },
    }, { OnRetry: Options.OnRetry, DeadlineMs });
    if (!PollResp.ok) continue;
    const Op = (await PollResp.json()) as {
      done?: boolean;
      error?: { code?: string | number; message?: string };
      status?: { code?: string | number; message?: string };
      response?: {
        assetId?: number | string;
        id?: number | string;
        moderationResult?: { moderationState?: string };
      };
    };
    const Failure = Op.error ?? Op.status;
    if (Failure) {
      const Message = `Upload operation failed: ${Failure.message ?? JSON.stringify(Failure)}`;
      if (IsTransientOperationFailure(Failure)) throw new Error(Message);
      throw new NonRetryableAssetUploadError(Message);
    }
    const RawId = Op.response?.assetId ?? Op.response?.id;
    const Id = typeof RawId === "string" ? parseInt(RawId, 10) : RawId;
    if (Op.done && typeof Id === "number" && Number.isFinite(Id)) {
      return Id;
    }
    if (Op.done) {
      throw new Error(`Upload operation ${OpId} completed without an asset id`);
    }
  }
  throw new Error(`Upload operation ${OpId} did not complete within ${PollMaxMs}ms`);
}

function ParseUserId(RobloxUserId: string): number | string {
  const Parsed = Number(RobloxUserId);
  return Number.isSafeInteger(Parsed) && Parsed > 0 ? Parsed : RobloxUserId;
}

function ShouldFallbackToDecal(Err: unknown): boolean {
  const Message = (Err as Error).message ?? String(Err);
  return Message.includes("Image") && Message.includes("400") && !IsExplicitUploadRejectionMessage(Message);
}

async function ReadTokenDiagnostics(
  AccessToken: string,
  Status: number,
  Body: string,
  Cache?: UploadDiagnosticsCache,
): Promise<string | null> {
  if (!IsAuthRejected(Status, Body)) return null;
  if (Cache) {
    Cache.TokenDiagnostics ??= ReadTokenDiagnosticsUncached(AccessToken);
    return Cache.TokenDiagnostics;
  }
  return ReadTokenDiagnosticsUncached(AccessToken);
}

async function ReadTokenDiagnosticsUncached(AccessToken: string): Promise<string | null> {
  const Parts = await Promise.all([
    ReadTokenIntrospection(AccessToken),
    ReadTokenResources(AccessToken),
  ]);
  return Parts.filter(Boolean).join(" ") || null;
}

async function ReadTokenIntrospection(AccessToken: string): Promise<string | null> {
  try {
    const Resp = await WorkerRawFetch("/Auth/Introspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Token: AccessToken }),
    });
    if (!Resp.ok) return `OAuth introspect failed (${Resp.status}): ${await ReadShort(Resp)}`;
    const Data = (await Resp.json()) as TokenIntrospection & { Error?: string };
    if (Data.Error) return `OAuth introspect error: ${Data.Error}`;
    return `OAuth token: active=${Data.active === true}; sub=${Data.sub ?? "?"}; client=${Data.client_id ?? "?"}; scope=[${Data.scope ?? "none"}].`;
  } catch (Err) {
    return `OAuth introspect failed: ${(Err as Error).message ?? String(Err)}`;
  }
}

async function ReadTokenResources(AccessToken: string): Promise<string | null> {
  try {
    const Resp = await WorkerRawFetch("/Auth/Resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Token: AccessToken }),
    });
    if (!Resp.ok) return `OAuth resources check failed (${Resp.status}): ${await ReadShort(Resp)}`;
    const Data = (await Resp.json()) as { resource_infos?: TokenResourceInfo[]; Error?: string };
    return SummarizeResources(Data);
  } catch (Err) {
    return `OAuth resources check failed: ${(Err as Error).message ?? String(Err)}`;
  }
}

function SummarizeResources(Data: { resource_infos?: TokenResourceInfo[]; Error?: string }): string {
  if (Data.Error) return `OAuth resources error: ${Data.Error}`;
  const Infos = Data.resource_infos ?? [];
  if (Infos.length === 0) return "OAuth resources: none returned; missing creator resource grant.";
  const HasCreatorGrant = Infos.some((Info) => Info.resources?.creator?.ids?.includes("U"));
  const Parts = Infos.map((Info) => {
    const Owner = `${Info.owner?.type ?? "?"}:${Info.owner?.id ?? "?"}`;
    const CreatorIds = Info.resources?.creator?.ids?.join(",") || "none";
    return `${Owner} creator=[${CreatorIds}]`;
  });
  return `OAuth resources: ${HasCreatorGrant ? "creator grant present" : "missing creator U grant"}; ${Parts.join("; ")}`;
}

function IsAuthRejected(Status: number, Body: string): boolean {
  return (Status === 401 || Status === 403) && Body.includes("User not authenticated");
}

function IsCredentialOrPermissionRejected(Status: number, Body: string): boolean {
  if (Status === 401) return true;
  return /User not authenticated|OAuth bearer|INSUFFICIENT_SCOPE|PERMISSION_DENIED|scope/i.test(Body);
}

function IsNonRetryableUploadRejection(Status: number, Body: string): boolean {
  return !ShouldRetryStatus(Status)
    && !IsCredentialOrPermissionRejected(Status, Body)
    && (IsExplicitUploadRejectionMessage(Body) || /invalid image|too large|unsupported/i.test(Body));
}

function IsExplicitUploadRejectionMessage(Message: string): boolean {
  return /moderation|moderated|rejected|not approved/i.test(Message);
}

function IsTransientOperationFailure(Failure: { code?: string | number; message?: string }): boolean {
  const Code = String(Failure.code ?? "").toUpperCase();
  const Message = Failure.message ?? "";
  return Code === "429"
    || Code === "500"
    || Code === "503"
    || Code.includes("RESOURCE_EXHAUSTED")
    || Code.includes("INTERNAL")
    || Code.includes("UNAVAILABLE")
    || /rate limit|server error|temporar|try again/i.test(Message);
}

function UploadErrorMessage(Status: number, Body: string, AssetType: AssetType, Diagnostics: string | null): string {
  if (IsAuthRejected(Status, Body)) {
    const Suffix = Diagnostics ? ` ${Diagnostics}` : "";
    return `Roblox rejected the OAuth bearer during ${AssetType} upload (${Status}): ${Body}.${Suffix}`;
  }
  return `${AssetType} upload failed (${Status}): ${Body}`;
}

async function FetchWithRetry(
  Path: string,
  Init: RequestInit,
  Options: FetchRetryOptions,
): Promise<Response> {
  for (let Attempt = 1; Attempt <= FetchMaxAttempts; Attempt++) {
    let Resp: Response;
    try {
      Resp = await WorkerRawFetch(Path, Init);
    } catch (Err) {
      if (Attempt >= FetchMaxAttempts) throw Err;
      const WaitMs = RetryDelayMs(null, Attempt, Options.DeadlineMs);
      if (WaitMs <= 0) throw Err;
      Options.OnRetry?.(Math.ceil(WaitMs / 1000), "network error");
      await Sleep(WaitMs);
      continue;
    }
    if (!ShouldRetryStatus(Resp.status) || Attempt >= FetchMaxAttempts) {
      return Resp;
    }
    const WaitMs = RetryDelayMs(Resp, Attempt, Options.DeadlineMs);
    if (WaitMs <= 0) return Resp;
    Options.OnRetry?.(Math.ceil(WaitMs / 1000), RetryReason(Resp.status));
    await Sleep(WaitMs);
  }
  throw new Error("unreachable retry loop");
}

async function ReadShort(Resp: Response): Promise<string> {
  try {
    const Text = await Resp.text();
    return Text.length > 240 ? `${Text.slice(0, 240)}...` : Text;
  } catch {
    return Resp.statusText;
  }
}

function SanitizeName(Name: string): string {
  const Clean = Name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 50);
  return Clean.length > 0 ? Clean : "FigmaBake";
}

function ShouldRetryStatus(Status: number): boolean {
  return Status === 408 || Status === 409 || Status === 425 || Status === 429 || Status >= 500;
}

function RetryReason(Status: number): string {
  if (Status === 429) return "rate limit";
  if (Status >= 500) return `server error ${Status}`;
  return `HTTP ${Status}`;
}

function RetryDelayMs(Resp: Response | null, Attempt: number, DeadlineMs?: number): number {
  const HeaderDelay = Resp ? ParseRetryAfter(Resp.headers.get("Retry-After")) : null;
  const BaseDelay = HeaderDelay !== null ? HeaderDelay : 2 ** (Attempt - 1);
  const CappedMs = Math.min(BaseDelay, RetryMaxSeconds) * 1000;
  if (DeadlineMs === undefined) return CappedMs;
  return Math.min(CappedMs, Math.max(0, DeadlineMs - Date.now()));
}

function ParseRetryAfter(Value: string | null): number | null {
  if (!Value) return null;
  const Seconds = Number(Value);
  if (Number.isFinite(Seconds) && Seconds > 0) return Math.ceil(Seconds);
  const DateMs = Date.parse(Value);
  if (!Number.isFinite(DateMs)) return null;
  return Math.max(1, Math.ceil((DateMs - Date.now()) / 1000));
}

function Sleep(Ms: number): Promise<void> {
  return new Promise((Resolve) => setTimeout(Resolve, Ms));
}
