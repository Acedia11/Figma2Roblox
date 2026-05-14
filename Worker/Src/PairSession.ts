import { DurableObject } from "cloudflare:workers";
import type { Env } from "./Types.ts";
import { WithCors } from "./Cors.ts";

const PollTimeoutMs = 25000;

type Resolver = (Payload: unknown) => void;

export class PairSession extends DurableObject<Env> {
  private Sequence = 0;
  private LatestPayload: unknown = null;
  private Waiters: Resolver[] = [];

  constructor(Ctx: DurableObjectState, EnvArg: Env) {
    super(Ctx, EnvArg);
    Ctx.blockConcurrencyWhile(async () => {
      const Stored = await Ctx.storage.get(["Sequence", "LatestPayload"]);
      const Sequence = Stored.get("Sequence");
      this.Sequence = typeof Sequence === "number" ? Sequence : 0;
      this.LatestPayload = Stored.get("LatestPayload") ?? null;
    });
  }

  override async fetch(Req: Request): Promise<Response> {
    const Url = new URL(Req.url);
    if (Req.method === "POST" && Url.pathname.endsWith("/Push")) return this.HandlePush(Req);
    if (Req.method === "GET" && Url.pathname.endsWith("/Poll")) return this.HandlePoll(Req);
    return WithCors(new Response("Method Not Allowed", { status: 405 }));
  }

  private async HandlePush(Req: Request): Promise<Response> {
    try {
      const Body = (await Req.json()) as Record<string, unknown>;
      this.Sequence += 1;
      const LatestPayload = { Sequence: this.Sequence, ...Body };
      this.LatestPayload = LatestPayload;
      await this.ctx.storage.put({ Sequence: this.Sequence, LatestPayload });
      const Waiters = this.Waiters;
      this.Waiters = [];
      for (const Resolve of Waiters) {
        Resolve(LatestPayload);
      }
      return WithCors(Response.json({ Sequence: this.Sequence }));
    } catch (Err) {
      return WithCors(Response.json({ Error: String(Err) }, { status: 500 }));
    }
  }

  private async HandlePoll(Req: Request): Promise<Response> {
    const Url = new URL(Req.url);
    const Since = Number(Url.searchParams.get("since") ?? "0");

    if (this.LatestPayload && this.Sequence > Since) {
      return WithCors(Response.json(this.LatestPayload));
    }

    const Payload = await new Promise<unknown>((Resolve) => {
      let Resolver: Resolver | null = null;
      const Cleanup = (): void => {
        if (!Resolver) return;
        const Index = this.Waiters.indexOf(Resolver);
        if (Index >= 0) this.Waiters.splice(Index, 1);
        Resolver = null;
      };
      const TimeoutHandle = setTimeout(() => {
        Cleanup();
        Resolve(null);
      }, PollTimeoutMs);
      Resolver = (P) => {
        clearTimeout(TimeoutHandle);
        Resolve(P);
      };
      Req.signal.addEventListener("abort", () => {
        clearTimeout(TimeoutHandle);
        Cleanup();
        Resolve(null);
      });
      this.Waiters.push(Resolver);
    });

    if (!Payload) return WithCors(new Response(null, { status: 204 }));
    return WithCors(Response.json(Payload));
  }
}
