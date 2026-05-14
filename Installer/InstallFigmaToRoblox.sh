#!/bin/bash
set -euo pipefail

ScriptDir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PayloadDir="$ScriptDir/Payload"
RobloxPluginsDir="${FIGMATOROBLOX_ROBLOX_PLUGINS_DIR:-$HOME/Documents/Roblox/Plugins}"
FigmaInstallRoot="${FIGMATOROBLOX_FIGMA_INSTALL_ROOT:-$HOME/Library/Application Support/FigmaToRoblox}"
OpenFolder=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --payload-dir)
      PayloadDir="$2"
      shift 2
      ;;
    --roblox-plugins-dir)
      RobloxPluginsDir="$2"
      shift 2
      ;;
    --figma-install-root)
      FigmaInstallRoot="$2"
      shift 2
      ;;
    --no-open)
      OpenFolder=0
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

RbxmPath="$PayloadDir/FigmaToRoblox.rbxm"
FigmaZipPath="$PayloadDir/FigmaToRoblox-FigmaPlugin.zip"
InstalledRbxmPath="$RobloxPluginsDir/FigmaToRoblox.rbxm"
FigmaPluginDir="$FigmaInstallRoot/FigmaPlugin"
ManifestPath="$FigmaPluginDir/manifest.json"
TempExtractDir="$(mktemp -d "${TMPDIR:-/tmp}/FigmaToRobloxInstall.XXXXXX")"
ExtractedRoot="$TempExtractDir/FigmaToRoblox-FigmaPlugin"

cleanup() {
  rm -rf "$TempExtractDir"
}
trap cleanup EXIT

Step() {
  echo
  echo "==> $1"
}

AssertFile() {
  local PathValue="$1"
  local Label="$2"

  if [ ! -f "$PathValue" ]; then
    echo "$Label was not found at: $PathValue" >&2
    exit 1
  fi
}

RemoveKnownFigmaPluginFolder() {
  local PathValue="$1"

  case "$PathValue" in
    */FigmaPlugin)
      rm -rf "$PathValue"
      ;;
    *)
      echo "Refusing to remove unexpected Figma plugin folder: $PathValue" >&2
      exit 1
      ;;
  esac
}

echo "FigmaToRoblox setup wizard"
echo "This installs the bundled FigmaToRoblox release files for the current macOS user."

Step "Checking bundled payloads"
AssertFile "$RbxmPath" "Roblox Studio plugin"
AssertFile "$FigmaZipPath" "Figma plugin zip"

if ! command -v unzip >/dev/null 2>&1; then
  echo "The unzip command is required but was not found." >&2
  exit 1
fi

unzip -q "$FigmaZipPath" -d "$TempExtractDir"
AssertFile "$ExtractedRoot/manifest.json" "Extracted Figma manifest"

Step "Installing Roblox Studio plugin"
mkdir -p "$RobloxPluginsDir"
cp -f "$RbxmPath" "$InstalledRbxmPath"
echo "Installed: $InstalledRbxmPath"

Step "Installing Figma plugin files"
RemoveKnownFigmaPluginFolder "$FigmaPluginDir"
mkdir -p "$FigmaPluginDir"

cp -R "$ExtractedRoot/." "$FigmaPluginDir/"
AssertFile "$ManifestPath" "Installed Figma manifest"
echo "Installed: $FigmaPluginDir"

if [ "$OpenFolder" -eq 1 ]; then
  Step "Opening the Figma plugin folder"
  open "$FigmaPluginDir"
fi

Step "Final setup steps"
echo "Figma manifest path:"
echo "$ManifestPath"
echo
echo "1. Open the Figma desktop app."
echo "2. Choose Plugins > Development > Import new plugin from manifest..."
echo "3. Select the manifest.json path shown above."
echo "4. Open Roblox Studio."
echo "5. Sign in with the same Roblox account in both FigmaToRoblox plugins."
echo
echo "Install complete."
