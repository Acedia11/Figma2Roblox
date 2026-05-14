# Security

Report security issues through GitHub issues for now.

## Secrets

- Do not commit `Worker/.dev.vars`, `.env`, or local plugin storage.
- Local Worker development uses `Worker/.dev.vars`.
- Production Worker deployments must use Cloudflare Worker secrets, especially `RobloxClientSecret`.

## Hosted Worker

The default plugins use `https://acedian.com/FigmaToRoblox/Api`. OAuth token exchange, token refresh, Open Cloud asset upload proxying, token diagnostics, and pair polling pass through that Worker. Tokens are not meant to be persisted by the Worker; the plugins store their own tokens locally.
