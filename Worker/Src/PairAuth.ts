import type { Env } from "./Types.ts";
import { JsonError } from "./Http.ts";

const RobloxIntrospectUrl = "https://apis.roblox.com/oauth/v1/token/introspect";

type Introspection = {
  active?: boolean;
  client_id?: string;
  sub?: string;
};

export async function RequirePairAuth(Req: Request, Env: Env, PairId: string): Promise<Response | null> {
  const Token = BearerToken(Req);
  if (!Token) return JsonError("Missing Bearer token", 401);

  const Introspected = await IntrospectToken(Token, Env);
  if (Introspected instanceof Response) return Introspected;

  if (Introspected.active !== true) return JsonError("Invalid Bearer token", 401);
  if (Introspected.client_id !== Env.RobloxClientId) return JsonError("Invalid Bearer token", 401);
  if (String(Introspected.sub ?? "") !== PairId) return JsonError("Bearer token does not match pair", 403);

  return null;
}

function BearerToken(Req: Request): string | null {
  const Auth = Req.headers.get("Authorization");
  if (!Auth || !Auth.startsWith("Bearer ")) return null;
  const Token = Auth.slice("Bearer ".length).trim();
  return Token.length > 0 ? Token : null;
}

async function IntrospectToken(Token: string, Env: Env): Promise<Introspection | Response> {
  let Resp: Response;
  try {
    Resp = await fetch(RobloxIntrospectUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: Token,
        client_id: Env.RobloxClientId,
        client_secret: Env.RobloxClientSecret,
      }).toString(),
    });
  } catch (Err) {
    return JsonError(`Token introspection unavailable: ${String(Err)}`, 502);
  }

  if (!Resp.ok) return JsonError("Invalid Bearer token", 401);

  try {
    return (await Resp.json()) as Introspection;
  } catch {
    return JsonError("Invalid token introspection response", 401);
  }
}
