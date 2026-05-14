import type { Env } from "./Types.ts";
import { JsonError, JsonResponse, MethodNotAllowed, RelayUpstream, RequireBearer } from "./Http.ts";

const StateTtlSeconds = 300;
const RobloxTokenUrl = "https://apis.roblox.com/oauth/v1/token";
const RobloxUserInfoUrl = "https://apis.roblox.com/oauth/v1/userinfo";
const RobloxIntrospectUrl = "https://apis.roblox.com/oauth/v1/token/introspect";
const RobloxResourcesUrl = "https://apis.roblox.com/oauth/v1/token/resources";

export async function HandleAuthCallback(Req: Request, Env: Env): Promise<Response> {
  const Url = new URL(Req.url);
  const Code = Url.searchParams.get("code");
  const State = Url.searchParams.get("state");
  const ErrorParam = Url.searchParams.get("error");

  if (ErrorParam) {
    return Html(`Sign-in failed: <code>${EscapeHtml(ErrorParam)}</code>. You can close this tab.`, 400);
  }
  if (!Code || !State) {
    return Html("Missing <code>code</code> or <code>state</code> parameter.", 400);
  }

  await Env.AUTH_STATE.put(`Code:${State}`, Code, { expirationTtl: StateTtlSeconds });
  return Html("Signed in! You can close this tab and return to the plugin.", 200);
}

export async function HandleAuthPickup(Req: Request, Env: Env): Promise<Response> {
  const Url = new URL(Req.url);
  const State = Url.searchParams.get("state");
  if (!State) {
    return JsonError("Missing state", 400);
  }
  const Code = await Env.AUTH_STATE.get(`Code:${State}`);
  if (!Code) return JsonResponse({ Pending: true }, 404);
  await Env.AUTH_STATE.delete(`Code:${State}`);
  return JsonResponse({ Code });
}

async function ParseBody<T extends Record<string, unknown>>(Req: Request, Required: (keyof T)[]): Promise<T | Response> {
  if (Req.method !== "POST") return MethodNotAllowed("POST");
  let Body: unknown;
  try {
    Body = await Req.json();
  } catch {
    return JsonError("Invalid JSON body", 400);
  }
  if (!Body || typeof Body !== "object") {
    return JsonError("Body must be a JSON object", 400);
  }
  const Typed = Body as T;
  for (const Key of Required) {
    if (!Typed[Key]) return JsonError(`Missing ${String(Key)}`, 400);
  }
  return Typed;
}

async function PostForm(Url: string, Fields: Record<string, string>): Promise<Response> {
  return RelayUpstream(Url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(Fields).toString(),
  });
}

export async function HandleAuthExchange(Req: Request, Env: Env): Promise<Response> {
  const Body = await ParseBody<{ Code: string; Verifier: string }>(Req, ["Code", "Verifier"]);
  if (Body instanceof Response) return Body;
  return PostForm(RobloxTokenUrl, {
    grant_type: "authorization_code",
    code: Body.Code,
    code_verifier: Body.Verifier,
    client_id: Env.RobloxClientId,
    client_secret: Env.RobloxClientSecret,
    redirect_uri: Env.RobloxRedirectUri,
  });
}

export async function HandleAuthRefresh(Req: Request, Env: Env): Promise<Response> {
  const Body = await ParseBody<{ RefreshToken: string }>(Req, ["RefreshToken"]);
  if (Body instanceof Response) return Body;
  return PostForm(RobloxTokenUrl, {
    grant_type: "refresh_token",
    refresh_token: Body.RefreshToken,
    client_id: Env.RobloxClientId,
    client_secret: Env.RobloxClientSecret,
  });
}

export async function HandleUserInfo(Req: Request, _Env: Env): Promise<Response> {
  if (Req.method !== "GET") return MethodNotAllowed("GET");
  const Auth = RequireBearer(Req);
  if (Auth instanceof Response) return Auth;
  return RelayUpstream(RobloxUserInfoUrl, {
    method: "GET",
    headers: { "Authorization": Auth },
  });
}

export async function HandleAuthIntrospect(Req: Request, Env: Env): Promise<Response> {
  const Body = await ParseBody<{ Token: string }>(Req, ["Token"]);
  if (Body instanceof Response) return Body;
  return PostForm(RobloxIntrospectUrl, {
    token: Body.Token,
    client_id: Env.RobloxClientId,
    client_secret: Env.RobloxClientSecret,
  });
}

export async function HandleAuthResources(Req: Request, Env: Env): Promise<Response> {
  const Body = await ParseBody<{ Token: string }>(Req, ["Token"]);
  if (Body instanceof Response) return Body;
  return PostForm(RobloxResourcesUrl, {
    token: Body.Token,
    client_id: Env.RobloxClientId,
    client_secret: Env.RobloxClientSecret,
  });
}

function Html(Message: string, Status: number): Response {
  const Body = `<!DOCTYPE html>
<html><head><title>FigmaToRoblox</title><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;padding:48px;max-width:560px;margin:0 auto;text-align:center;color:#222">
<h1 style="font-weight:600;margin-bottom:16px">FigmaToRoblox</h1>
<p style="font-size:16px;line-height:1.5">${Message}</p>
</body></html>`;
  return new Response(Body, { status: Status, headers: { "Content-Type": "text/html;charset=utf-8" } });
}

function EscapeHtml(Raw: string): string {
  return Raw.replace(/[&<>"']/g, (C) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[C] ?? C));
}
