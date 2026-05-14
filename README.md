# Figma2Roblox

Sync selected Figma UI into Roblox Studio.

## Setup

You need:

- Figma desktop
- Roblox Studio
- A Roblox account that can create image assets

1. Go to the latest GitHub release.
2. Download the setup zip:
   - Windows: `Figma2RobloxSetup-Windows.zip`
   - macOS: `Figma2RobloxSetup-macOS.zip`
3. Unzip it.
4. Run the installer:
   - Windows: double-click `InstallFigmaToRoblox.cmd`
   - macOS: double-click `InstallFigmaToRoblox.command`
5. The installer opens the Figma plugin folder and prints the `manifest.json` path.
6. In Figma desktop, go to `Plugins > Development > Import new plugin from manifest...` and pick that `manifest.json`.
7. Open Roblox Studio, open the FigmaToRoblox plugin, and sign in. (make sure you actually SELECT your account when in the oauth flow)
8. In Figma, open `Plugins > Development > FigmaToRoblox` and sign in with the same Roblox account.
9. In Studio, click `Enable sync to this place`.
10. In Figma, select UI and click `Sync to Roblox`.

Figma browser cannot load development plugins. Use the desktop app.

## Notes

- Only keep one Roblox Studio instance syncing per Roblox account.
- If Roblox sign-in says the OAuth app is unavailable, the app may still be private or pending approval.
- Release builds use the hosted Worker at `https://acedian.com/FigmaToRoblox/Api`.

## Dev

```powershell
npm run Test
npm run Build:Release
```

More notes:

- `FigmaPlugin/README.md`
- `RobloxPlugin/README.md`
- `Worker/README.md`
