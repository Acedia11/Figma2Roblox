# FigmaToRoblox - Worker

Cloudflare Worker relay for FigmaToRoblox. It owns OAuth callback pickup, token proxy endpoints, Roblox asset upload proxying, and Durable Object pair sessions.

## Commands

```powershell
npm install
npm run dev
```

```powershell
npm run types
npm test
npx tsc --noEmit
```

```powershell
npm run deploy -- --env production
```

`npm test` runs the Cloudflare Worker runtime tests with Durable Object bindings.

## Configuration

`wrangler.jsonc` defines the Durable Object binding, KV namespace binding, production route, and public OAuth vars:

- `PAIR_SESSIONS`: Durable Object namespace for pair channels.
- `AUTH_STATE`: KV namespace for temporary OAuth code pickup.
- `RobloxClientId`: OAuth app client id.
- `RobloxRedirectUri`: local or production callback URL.

`RobloxClientSecret` must be configured as a Worker secret, not committed.

## Endpoints

- `GET /Status`: health/version response.
- `GET /Auth/Callback`: OAuth redirect landing page; stores the authorization code by state.
- `GET /Auth/PickupCode?state=...`: returns the stored OAuth code once, or pending.
- `POST /Auth/Exchange`: exchanges an authorization code through Roblox OAuth.
- `POST /Auth/Refresh`: refreshes Roblox OAuth tokens.
- `GET /Auth/UserInfo`: relays Roblox userinfo using a bearer token.
- `POST /Auth/Introspect`: token diagnostics.
- `POST /Auth/Resources`: resource grant diagnostics.
- `POST /Assets/Upload`: multipart proxy to Roblox Open Cloud assets.
- `GET /Assets/Operation/:id`: polls Roblox Open Cloud asset operations.
- `POST /Pair/:id/Push`: validates the bearer token owner, then stores and fan-outs the latest Figma payload for a pair channel.
- `GET /Pair/:id/Poll?since=...`: validates the bearer token owner, then long-polls the latest payload for Studio.

## Current Pairing Limitation

Pair channels are currently named by Roblox user id, and the Worker validates that the bearer token subject matches that user id before allowing push or poll. Same-account Studio sessions still share the same stream if they both enable sync, so explicit pair codes or another per-Studio destination id remain the next routing improvement.
