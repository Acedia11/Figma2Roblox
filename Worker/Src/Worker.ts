import type { Env } from "./Types.ts";
import { PairSession } from "./PairSession.ts";
import { HandleAuthCallback, HandleAuthPickup, HandleAuthExchange, HandleAuthRefresh, HandleUserInfo, HandleAuthIntrospect, HandleAuthResources } from "./Auth.ts";
import { HandleAssetsUpload, HandleAssetsOperation } from "./Assets.ts";
import { Preflight, WithCors } from "./Cors.ts";
import { JsonError } from "./Http.ts";
import { RequirePairAuth } from "./PairAuth.ts";

export { PairSession };

export default {
  async fetch(Req: Request, EnvArg: Env, _Ctx: ExecutionContext): Promise<Response> {
    if (Req.method === "OPTIONS") return Preflight();

    const Url = new URL(Req.url);
    const Path = Url.pathname.replace(/^\/FigmaToRoblox\/Api/, "") || "/";

    const PairMatch = Path.match(/^\/Pair\/([^/]+)\/(Push|Poll)$/);
    if (PairMatch) {
      let PairId: string;
      try {
        PairId = decodeURIComponent(PairMatch[1] ?? "");
      } catch {
        return JsonError("Invalid pair id", 400);
      }
      if (PairId) {
        const AuthError = await RequirePairAuth(Req, EnvArg, PairId);
        if (AuthError) return AuthError;

        const DOId = EnvArg.PAIR_SESSIONS.idFromName(PairId);
        const Stub = EnvArg.PAIR_SESSIONS.get(DOId);
        return Stub.fetch(Req);
      }
    }

    if (Path === "/Auth/Callback") return HandleAuthCallback(Req, EnvArg);
    if (Path === "/Auth/PickupCode") return HandleAuthPickup(Req, EnvArg);
    if (Path === "/Auth/Exchange") return HandleAuthExchange(Req, EnvArg);
    if (Path === "/Auth/Refresh") return HandleAuthRefresh(Req, EnvArg);
    if (Path === "/Auth/UserInfo") return HandleUserInfo(Req, EnvArg);
    if (Path === "/Auth/Introspect") return HandleAuthIntrospect(Req, EnvArg);
    if (Path === "/Auth/Resources") return HandleAuthResources(Req, EnvArg);

    if (Path === "/Assets/Upload") return HandleAssetsUpload(Req, EnvArg);
    const OpMatch = Path.match(/^\/Assets\/Operation\/([^/]+)$/);
    if (OpMatch && OpMatch[1]) return HandleAssetsOperation(Req, EnvArg, OpMatch[1]);

    if (Path === "/Status") {
      return WithCors(Response.json({ Ok: true, Version: "0.2.0" }));
    }

    return WithCors(new Response("Not Found", { status: 404 }));
  },
} satisfies ExportedHandler<Env>;
