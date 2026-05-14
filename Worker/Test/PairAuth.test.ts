import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../Src/Types.ts";
import Worker from "../Src/Worker.ts";

const BaseUrl = "https://acedian.com/FigmaToRoblox/Api";
const PairId = "12345";
const ClientId = "8400817234833495861";

type ErrorBody = { Error?: string };
type PushBody = { Sequence?: number };
type PollBody = { Sequence?: number; Tree?: unknown };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pair auth", () => {
  it("returns 401 for push without bearer", async () => {
    const Resp = await Fetch(`/Pair/${PairId}/Push`, { method: "POST", body: "{}" });

    expect(Resp.status).toBe(401);
    await ExpectError(Resp, "Missing Bearer token");
  });

  it("returns 401 for poll without bearer", async () => {
    const Resp = await Fetch(`/Pair/${PairId}/Poll?since=0`);

    expect(Resp.status).toBe(401);
    await ExpectError(Resp, "Missing Bearer token");
  });

  it("returns 401 for inactive tokens", async () => {
    MockIntrospection({ active: false, client_id: ClientId, sub: PairId });

    const Resp = await AuthedFetch("inactive-token", `/Pair/${PairId}/Push`, { method: "POST", body: "{}" });

    expect(Resp.status).toBe(401);
    await ExpectError(Resp, "Invalid Bearer token");
  });

  it("returns 403 for tokens belonging to another user", async () => {
    MockIntrospection({ active: true, client_id: ClientId, sub: "67890" });

    const Resp = await AuthedFetch("wrong-user-token", `/Pair/${PairId}/Push`, { method: "POST", body: "{}" });

    expect(Resp.status).toBe(403);
    await ExpectError(Resp, "Bearer token does not match pair");
  });

  it("returns 401 for tokens minted for another client", async () => {
    MockIntrospection({ active: true, client_id: "other-client", sub: PairId });

    const Resp = await AuthedFetch("wrong-client-token", `/Pair/${PairId}/Push`, { method: "POST", body: "{}" });

    expect(Resp.status).toBe(401);
    await ExpectError(Resp, "Invalid Bearer token");
  });

  it("allows valid push and poll round-trip", async () => {
    MockIntrospection({ active: true, client_id: ClientId, sub: PairId });

    const PushResp = await AuthedFetch("valid-token", `/Pair/${PairId}/Push`, {
      method: "POST",
      body: JSON.stringify({ Tree: { FigmaId: "Root", Kind: "Frame" } }),
    });
    const Push = await PushResp.json<PushBody>();

    expect(PushResp.status).toBe(200);
    expect(Push.Sequence).toBe(1);

    const PollResp = await AuthedFetch("valid-token", `/Pair/${PairId}/Poll?since=0`);
    const Poll = await PollResp.json<PollBody>();

    expect(PollResp.status).toBe(200);
    expect(Poll.Sequence).toBe(1);
    expect(Poll.Tree).toEqual({ FigmaId: "Root", Kind: "Frame" });
  });
});

function MockIntrospection(Body: Record<string, unknown>): void {
  vi.stubGlobal("fetch", vi.fn(async (Input: RequestInfo | URL, Init?: RequestInit) => {
    const Url = typeof Input === "string" ? Input : Input instanceof URL ? Input.toString() : Input.url;
    if (Url !== "https://apis.roblox.com/oauth/v1/token/introspect") {
      return new Response("Unexpected fetch target", { status: 500 });
    }
    const Params = new URLSearchParams(String(Init?.body ?? ""));
    if (!Params.get("token") || Params.get("client_id") !== ClientId) {
      return new Response("Bad introspection request", { status: 400 });
    }
    return Response.json(Body);
  }));
}

function Fetch(Path: string, Init?: RequestInit): Promise<Response> {
  const Ctx = createExecutionContext();
  return Worker.fetch(new Request(`${BaseUrl}${Path}`, Init), env as unknown as Env, Ctx);
}

function AuthedFetch(Token: string, Path: string, Init: RequestInit = {}): Promise<Response> {
  const HeaderBag = new Headers(Init.headers);
  HeaderBag.set("Authorization", `Bearer ${Token}`);
  if (Init.body && !HeaderBag.has("Content-Type")) HeaderBag.set("Content-Type", "application/json");
  return Fetch(Path, { ...Init, headers: HeaderBag });
}

async function ExpectError(Resp: Response, Message: string): Promise<void> {
  const Body = await Resp.json<ErrorBody>();
  expect(Body.Error).toBe(Message);
}
