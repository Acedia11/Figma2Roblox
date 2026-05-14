import { sha256 } from "js-sha256";
import { BaseUrl, WorkerFetch } from "./Worker";
import type { AuthBundle } from "./Types";

const ClientId = "8400817234833495861";
const AuthorizeBase = "https://authorize.roblox.com";
const Scopes = "openid profile asset:read asset:write";
const RedirectUri = `${BaseUrl}/Auth/Callback`;
const VerifierAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const VerifierLength = 64;
const PickupPollIntervalMs = 2000;
const DefaultPickupTimeoutSeconds = 300;
const RefreshGraceSeconds = 60;

export type SignInRequest = { Verifier: string; State: string; Url: string };
export type RobloxTokenResponse = { access_token: string; refresh_token: string; expires_in: number; token_type: string };
export type RobloxUserInfo = { sub: string; preferred_username?: string; name?: string };

type ResourceInfo = {
  owner?: { id?: string; type?: string };
  resources?: { creator?: { ids?: string[] } };
};

export class MissingCreatorGrantError extends Error {
  readonly Code = "MissingCreatorGrant" as const;
  constructor() {
    super(
      "You're signed in, but didn't authorize uploads to your account. On Roblox's authorize page, tick the checkbox under your username (\"Allow this app to act as you\") before clicking Authorize. Re-sign-in and select your account."
    );
    this.name = "MissingCreatorGrantError";
  }
}

export class RefreshTokenExpiredError extends Error {
  readonly Code = "RefreshTokenExpired" as const;
  constructor() {
    super("Your sign-in expired. Please sign in again.");
    this.name = "RefreshTokenExpiredError";
  }
}

function IsRefreshExpiredError(ErrStr: string): boolean {
  return ErrStr.includes("HTTP 400") && ErrStr.includes("invalid_grant");
}

export function GenerateVerifier(): string {
  const Bytes = new Uint8Array(VerifierLength);
  crypto.getRandomValues(Bytes);
  let Out = "";
  for (let I = 0; I < VerifierLength; I++) {
    Out += VerifierAlphabet.charAt((Bytes[I] ?? 0) % VerifierAlphabet.length);
  }
  return Out;
}

export function GenerateState(): string {
  const Bytes = new Uint8Array(16);
  crypto.getRandomValues(Bytes);
  return Array.from(Bytes, (B) => B.toString(16).padStart(2, "0")).join("");
}

function Base64UrlFromBuffer(Buffer: ArrayBuffer): string {
  const Bytes = new Uint8Array(Buffer);
  let Binary = "";
  for (let I = 0; I < Bytes.length; I++) {
    Binary += String.fromCharCode(Bytes[I] ?? 0);
  }
  return btoa(Binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function ChallengeFor(Verifier: string): string {
  return Base64UrlFromBuffer(sha256.arrayBuffer(Verifier));
}

export function BuildAuthorizeUrl(Verifier: string, State: string): string {
  const Challenge = ChallengeFor(Verifier);
  const Params = new URLSearchParams({
    client_id: ClientId,
    code_challenge: Challenge,
    code_challenge_method: "S256",
    redirect_uri: RedirectUri,
    scope: Scopes,
    response_type: "Code",
    state: State,
    prompts: "login consent",
  });
  return `${AuthorizeBase}?${Params.toString()}`;
}

export function BeginSignIn(): SignInRequest {
  const Verifier = GenerateVerifier();
  const State = GenerateState();
  const Url = BuildAuthorizeUrl(Verifier, State);
  return { Verifier, State, Url };
}

export type WaitForCodeOptions = { TimeoutSeconds?: number; ShouldCancel?: () => boolean };

export async function WaitForCode(State: string, Options: WaitForCodeOptions = {}): Promise<string> {
  const Timeout = Options.TimeoutSeconds ?? DefaultPickupTimeoutSeconds;
  const Deadline = Date.now() + Timeout * 1000;
  const Url = `/Auth/PickupCode?state=${encodeURIComponent(State)}`;
  while (Date.now() < Deadline) {
    if (Options.ShouldCancel?.()) {
      throw new Error("cancelled");
    }
    const Result = await WorkerFetch<{ Code?: string; Pending?: boolean }>(Url);
    if (Result.Ok && Result.Data?.Code) {
      return Result.Data.Code;
    }
    await new Promise((Resolve) => setTimeout(Resolve, PickupPollIntervalMs));
  }
  throw new Error(`timed out waiting for OAuth code (${Timeout}s)`);
}

export async function ExchangeCode(Code: string, Verifier: string): Promise<RobloxTokenResponse> {
  const Result = await WorkerFetch<RobloxTokenResponse | { Error: string }>("/Auth/Exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Code, Verifier }),
  });
  if (!Result.Ok) {
    throw new Error(Result.Error);
  }
  if (!("access_token" in Result.Data)) {
    throw new Error((Result.Data as { Error?: string }).Error ?? "token exchange returned no access_token");
  }
  return Result.Data;
}

export async function EnsureCreatorGrant(AccessToken: string, RobloxUserId: string): Promise<void> {
  const Result = await WorkerFetch<{ resource_infos?: ResourceInfo[] } | { Error: string }>("/Auth/Resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Token: AccessToken }),
  });
  if (!Result.Ok || !("resource_infos" in Result.Data)) return;
  const Infos = Result.Data.resource_infos ?? [];
  const HasGrant = Infos.some((Info) => {
    const OwnerType = Info.owner?.type ?? "";
    const OwnerId = String(Info.owner?.id ?? "");
    const CreatorIds = Info.resources?.creator?.ids ?? [];
    return OwnerType === "User" && OwnerId === String(RobloxUserId) && CreatorIds.includes("U");
  });
  if (!HasGrant) throw new MissingCreatorGrantError();
}

export async function FetchUserInfo(AccessToken: string): Promise<RobloxUserInfo> {
  const Result = await WorkerFetch<RobloxUserInfo | { Error: string }>("/Auth/UserInfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${AccessToken}` },
  });
  if (!Result.Ok) {
    throw new Error(Result.Error);
  }
  if (!("sub" in Result.Data)) {
    throw new Error((Result.Data as { Error?: string }).Error ?? "userinfo returned no sub");
  }
  return Result.Data;
}

export async function RefreshTokens(RefreshToken: string): Promise<RobloxTokenResponse> {
  const Result = await WorkerFetch<RobloxTokenResponse | { Error: string }>("/Auth/Refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ RefreshToken }),
  });
  if (!Result.Ok) {
    if (IsRefreshExpiredError(Result.Error)) {
      throw new RefreshTokenExpiredError();
    }
    throw new Error(Result.Error);
  }
  if (!("access_token" in Result.Data)) {
    throw new Error((Result.Data as { Error?: string }).Error ?? "refresh returned no access_token");
  }
  return Result.Data;
}

export function BundleFromTokens(Tokens: RobloxTokenResponse, UserInfo: RobloxUserInfo): AuthBundle {
  return {
    AccessToken: Tokens.access_token,
    RefreshToken: Tokens.refresh_token,
    ExpiresAt: Math.floor(Date.now() / 1000) + Tokens.expires_in - RefreshGraceSeconds,
    RobloxUserId: UserInfo.sub,
    UserName: UserInfo.preferred_username ?? UserInfo.name ?? `user ${UserInfo.sub}`,
  };
}

export async function RefreshIfExpired(Bundle: AuthBundle): Promise<AuthBundle> {
  const Now = Math.floor(Date.now() / 1000);
  if (Now < Bundle.ExpiresAt) {
    return Bundle;
  }
  const Tokens = await RefreshTokens(Bundle.RefreshToken);
  const RefreshToken = Tokens.refresh_token || Bundle.RefreshToken;
  return {
    ...Bundle,
    AccessToken: Tokens.access_token,
    RefreshToken,
    ExpiresAt: Math.floor(Date.now() / 1000) + Tokens.expires_in - RefreshGraceSeconds,
  };
}
