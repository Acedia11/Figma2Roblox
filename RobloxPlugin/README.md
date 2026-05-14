# FigmaToRoblox - Roblox Studio Plugin

Source for the Roblox Studio side of FigmaToRoblox. Built with Rojo into an `.rbxm` plugin file, dropped into `%LOCALAPPDATA%\Roblox\Plugins` for development, and published to the Creator Store for users.

## Install From GitHub Release

1. Download `FigmaToRoblox.rbxm` from the latest GitHub release.
2. Put it in your local Roblox plugin folder:

   ```powershell
   $env:LOCALAPPDATA\Roblox\Plugins
   ```

3. Restart Roblox Studio if it was already open.
4. Open the plugin dock, sign in with Roblox, then click `Enable sync to this place`.

## Build

```powershell
aftman install
rojo build default.project.json --output "$env:LOCALAPPDATA\Roblox\Plugins\FigmaToRoblox.rbxm"
```

Roblox Studio auto-reloads plugins from that folder. Re-run `rojo build` after edits.

## Contracts

Plugin always points at the deployed Worker (`https://acedian.com/FigmaToRoblox/Api/*`). Localhost is engine-blocked from `HttpService`, so there is no local-Worker dev path for the Roblox side. Iterate Worker code via `wrangler dev` against curl, then deploy before testing through Studio.

OAuth flow is PKCE. The plugin generates the authorize URL, shows it in a TextBox, the user manually copies it into a browser, signs in, the plugin polls `/Auth/PickupCode` until the code arrives, exchanges through the Worker token proxy, and stores tokens via `plugin:SetSetting`.

## Sync Behavior

After sign-in, the dock stays paused until the user clicks `Enable sync to this place`. Enabling sync starts long-polling `/Pair/<RobloxUserId>/Poll`; disabling sync stops that local poller. This prevents passive signed-in Studio instances from applying updates.

Current pairing is still by Roblox user id. If two Studio instances are signed into the same Roblox account and both have sync enabled, both receive the same Figma payload stream. Short pair codes are still needed for explicit multi-session routing.

The builder removes the previous generated `FigmaToRobloxRoot`, builds a fresh `ScreenGui` under `StarterGui`, resolves image assets from the payload cache, applies layout/text/image properties, and wraps the operation in ChangeHistory recording so normal undo can remove the sync.
