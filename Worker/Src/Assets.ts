import type { Env } from "./Types.ts";
import { JsonError, MethodNotAllowed, RelayUpstream, RequireBearer } from "./Http.ts";

const Upstream = "https://apis.roblox.com/assets/v1";
const RelayHeaders = ["Content-Type", "Retry-After"] as const;

export async function HandleAssetsUpload(Req: Request, _Env: Env): Promise<Response> {
  if (Req.method !== "POST") return MethodNotAllowed("POST");
  const Auth = RequireBearer(Req);
  if (Auth instanceof Response) return Auth;
  const ContentType = Req.headers.get("Content-Type") ?? "";
  if (!ContentType.toLowerCase().startsWith("multipart/form-data")) {
    return JsonError("Expected multipart/form-data", 400);
  }
  let Incoming: FormData;
  try {
    Incoming = await Req.formData();
  } catch (Err) {
    return JsonError(`Invalid multipart body: ${String(Err)}`, 400);
  }
  const RequestPart = Incoming.get("request");
  const FilePart = Incoming.get("fileContent");
  if (typeof RequestPart !== "string") {
    return JsonError("Missing 'request' part", 400);
  }
  if (FilePart === null || typeof FilePart === "string") {
    return JsonError("Missing 'fileContent' part", 400);
  }
  const Outgoing = new FormData();
  Outgoing.append("request", RequestPart);
  const FileName = "name" in FilePart && typeof (FilePart as { name?: unknown }).name === "string"
    ? (FilePart as { name: string }).name
    : "bake.png";
  Outgoing.append("fileContent", FilePart, FileName);
  const ForwardHeaders = new Headers();
  ForwardHeaders.set("Authorization", Auth);
  return RelayUpstream(`${Upstream}/assets`, {
    method: "POST",
    headers: ForwardHeaders,
    body: Outgoing,
  }, RelayHeaders);
}

export async function HandleAssetsOperation(Req: Request, _Env: Env, OpId: string): Promise<Response> {
  if (Req.method !== "GET") return MethodNotAllowed("GET");
  const Auth = RequireBearer(Req);
  if (Auth instanceof Response) return Auth;
  const ForwardHeaders = new Headers();
  ForwardHeaders.set("Authorization", Auth);
  return RelayUpstream(`${Upstream}/operations/${encodeURIComponent(OpId)}`, {
    method: "GET",
    headers: ForwardHeaders,
  }, RelayHeaders);
}
