param(
  [string] $PayloadDir = (Join-Path $PSScriptRoot "Payload"),
  [string] $RobloxPluginsDir = (Join-Path $env:LOCALAPPDATA "Roblox\Plugins"),
  [string] $FigmaInstallRoot = (Join-Path $env:LOCALAPPDATA "FigmaToRoblox"),
  [switch] $NoOpen,
  [switch] $NoPause
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-File {
  param(
    [string] $PathValue,
    [string] $Label
  )

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    throw "$Label was not found at: $PathValue"
  }
}

function Remove-KnownFigmaPluginFolder {
  param([string] $PathValue)

  if (-not $PathValue.EndsWith("FigmaPlugin", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove unexpected Figma plugin folder: $PathValue"
  }

  if (Test-Path -LiteralPath $PathValue) {
    Remove-Item -LiteralPath $PathValue -Recurse -Force
  }
}

try {
  $RbxmPath = Join-Path $PayloadDir "FigmaToRoblox.rbxm"
  $FigmaZipPath = Join-Path $PayloadDir "FigmaToRoblox-FigmaPlugin.zip"
  $InstalledRbxmPath = Join-Path $RobloxPluginsDir "FigmaToRoblox.rbxm"
  $FigmaPluginDir = Join-Path $FigmaInstallRoot "FigmaPlugin"
  $ManifestPath = Join-Path $FigmaPluginDir "manifest.json"
  $TempExtractDir = Join-Path ([System.IO.Path]::GetTempPath()) ("FigmaToRobloxInstall-" + [System.Guid]::NewGuid().ToString("N"))
  $ExtractedRoot = Join-Path $TempExtractDir "FigmaToRoblox-FigmaPlugin"

  Write-Host "FigmaToRoblox setup wizard" -ForegroundColor Green
  Write-Host "This installs the bundled FigmaToRoblox release files for the current Windows user."

  Write-Step "Checking bundled payloads"
  Assert-File -PathValue $RbxmPath -Label "Roblox Studio plugin"
  Assert-File -PathValue $FigmaZipPath -Label "Figma plugin zip"
  New-Item -ItemType Directory -Path $TempExtractDir -Force | Out-Null
  Expand-Archive -LiteralPath $FigmaZipPath -DestinationPath $TempExtractDir -Force
  Assert-File -PathValue (Join-Path $ExtractedRoot "manifest.json") -Label "Extracted Figma manifest"

  Write-Step "Installing Roblox Studio plugin"
  New-Item -ItemType Directory -Path $RobloxPluginsDir -Force | Out-Null
  Copy-Item -LiteralPath $RbxmPath -Destination $InstalledRbxmPath -Force
  Write-Host "Installed: $InstalledRbxmPath"

  Write-Step "Installing Figma plugin files"
  Remove-KnownFigmaPluginFolder -PathValue $FigmaPluginDir
  New-Item -ItemType Directory -Path $FigmaPluginDir -Force | Out-Null

  Get-ChildItem -LiteralPath $ExtractedRoot | Copy-Item -Destination $FigmaPluginDir -Recurse -Force
  Assert-File -PathValue $ManifestPath -Label "Installed Figma manifest"
  Write-Host "Installed: $FigmaPluginDir"

  if (-not $NoOpen) {
    Write-Step "Opening the Figma plugin folder"
    Start-Process explorer.exe -ArgumentList "`"$FigmaPluginDir`""
  }

  Write-Step "Final setup steps"
  Write-Host "Figma manifest path:"
  Write-Host $ManifestPath -ForegroundColor Yellow
  Write-Host ""
  Write-Host "1. Open the Figma desktop app."
  Write-Host "2. Choose Plugins > Development > Import new plugin from manifest..."
  Write-Host "3. Select the manifest.json path shown above."
  Write-Host "4. Open Roblox Studio."
  Write-Host "5. Sign in with the same Roblox account in both FigmaToRoblox plugins."
  Write-Host ""
  Write-Host "Install complete." -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "Install failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
} finally {
  if ($TempExtractDir -and (Test-Path -LiteralPath $TempExtractDir)) {
    Remove-Item -LiteralPath $TempExtractDir -Recurse -Force
  }
}

if (-not $NoPause) {
  Write-Host ""
  Read-Host "Press Enter to close this window"
}
