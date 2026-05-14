# FigmaToRoblox - Figma Plugin

The Figma side of FigmaToRoblox. It signs in with Roblox, walks the current selection, builds a `UiNode` tree matching the Roblox Studio Builder contract, bakes visual nodes to PNGs when needed, uploads missing images through Open Cloud, and POSTs the payload to the Worker.

## Install From GitHub Release

Requires the Figma desktop app. Browser Figma cannot load development plugins.

1. Download and unzip `FigmaToRoblox-FigmaPlugin.zip` from the latest GitHub release.
2. In Figma desktop, choose `Plugins > Development > Import plugin from manifest...`, then pick the unzipped `manifest.json`.
3. Open any Figma file, then choose `Plugins > Development > FigmaToRoblox` to launch the dock.

## Build From Source

Requires the Figma desktop app. Browser Figma cannot load development plugins.

1. Build the bundle:

   ```powershell
   cd FigmaPlugin
   npm install
   npm run build
   ```

   This produces `build/main.js`, `build/ui.js`, and a generated `manifest.json`.

2. In Figma desktop, choose `Plugins > Development > Import plugin from manifest...`, then pick `FigmaPlugin/manifest.json`.

3. Open any Figma file, then choose `Plugins > Development > FigmaToRoblox` to launch the dock.

## Sign-In Flow

1. Click `Sign in with Roblox`. A browser tab opens to Roblox authorization.
2. Authorize. The Worker callback page renders `Signed in!`; close it.
3. The plugin polls the Worker, picks up the code, exchanges via `/Auth/Exchange`, and lands in the signed-in state. Tokens persist in `figma.clientStorage`.

## Sync Flow

1. Open the companion Roblox Studio plugin with the same Roblox account.
2. In Studio, click `Enable sync to this place`.
3. In Figma, select one or more frames.
4. Choose whether to bake text as images, set export scale, and choose responsive scaling.
5. Click `Sync to Roblox`. The payload is pushed to the paired Studio plugin. Warm syncs are usually quick; first syncs for image-heavy selections can take longer while Roblox asset upload operations finish.

## Iterate

```powershell
npm run watch
```

Rebuilds on every file change. Use `Plugins > Development > Hot reload plugin` in Figma after edits.

## Notes

- All network goes through `https://acedian.com/FigmaToRoblox/Api`. Token exchange is proxied because the OAuth app is a confidential client.
- Visual nodes are baked to PNG, de-duplicated by hash, uploaded through the Worker to Roblox Open Cloud, and cached in `figma.clientStorage`.
- Retryable image upload failures stop the sync before the payload is pushed, leaving the existing Studio UI untouched. Image assets Roblox rejects as non-retryable are skipped, and Studio imports those nodes with placeholder images while the plugin reports which assets were skipped.
- Text can stay as real Roblox text or be baked as images. The default setting currently bakes text for visual fidelity.
- AutoLayout maps to `UIListLayout` plus `UIPadding` where supported.
- Responsive scaling can emit scale-based `UDim2` values and send the selected frame size so Studio can add an aspect ratio constraint.
- Pairing is keyed by Roblox user id. Multiple Studio sessions on the same account share the same stream; keep only one Studio instance enabled until explicit pair codes exist.
