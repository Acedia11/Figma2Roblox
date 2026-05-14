import { WithCors } from "./Cors.ts";

export function JsonResponse(Data: unknown, Status = 200): Response {
  return WithCors(Response.json(Data, { status: Status }));
}

export function JsonError(Message: string, Status: number): Response {
  return JsonResponse({ Error: Message }, Status);
}

export function MethodNotAllowed(Method: string): Response {
  return WithCors(new Response("Method Not Allowed", { status: 405, headers: { Allow: Method } }));
}

export function RequireBearer(Req: Request): string | Response {
  const Auth = Req.headers.get("Authorization");
  if (!Auth || !Auth.startsWith("Bearer ")) return JsonError("Missing Bearer token", 401);
  return Auth;
}

export async function RelayUpstream(
  Url: string,
  Init: RequestInit,
  HeaderNames: readonly string[] = ["Content-Type"],
): Promise<Response> {
  try {
    const Upstream = await fetch(Url, Init);
    return RelayResponse(Upstream, HeaderNames);
  } catch (Err) {
    return JsonError(String(Err), 502);
  }
}

export function RelayResponse(Upstream: Response, HeaderNames: readonly string[] = ["Content-Type"]): Response {
  const ResponseHeaders = new Headers();
  for (const HeaderName of HeaderNames) {
    const Value = Upstream.headers.get(HeaderName);
    if (Value) ResponseHeaders.set(HeaderName, Value);
  }
  if (!ResponseHeaders.has("Content-Type")) ResponseHeaders.set("Content-Type", "application/json");
  return WithCors(new Response(Upstream.body, { status: Upstream.status, headers: ResponseHeaders }));
}
