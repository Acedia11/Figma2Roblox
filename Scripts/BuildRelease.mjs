import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Run } from "./RunCommand.mjs";

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ReleaseDir = path.join(Root, "Release");
const InstallerDir = path.join(Root, "Installer");
const FigmaPluginBundleDir = "FigmaToRoblox-FigmaPlugin";
const FigmaPluginZipName = "FigmaToRoblox-FigmaPlugin.zip";
const RobloxPluginFileName = "FigmaToRoblox.rbxm";
const WindowsSetupZipName = "Figma2RobloxSetup-Windows.zip";
const MacSetupZipName = "Figma2RobloxSetup-macOS.zip";
const FigmaZipPath = path.join(ReleaseDir, FigmaPluginZipName);
const RobloxPluginPath = path.join(ReleaseDir, RobloxPluginFileName);
const WindowsSetupPath = path.join(ReleaseDir, WindowsSetupZipName);
const MacSetupPath = path.join(ReleaseDir, MacSetupZipName);
const ReadmePath = path.join(ReleaseDir, "README.txt");

function DosDateTime(DateValue) {
  const Year = Math.max(DateValue.getFullYear(), 1980);
  const DatePart = ((Year - 1980) << 9) | ((DateValue.getMonth() + 1) << 5) | DateValue.getDate();
  const TimePart = (DateValue.getHours() << 11) | (DateValue.getMinutes() << 5) | Math.floor(DateValue.getSeconds() / 2);
  return { DatePart, TimePart };
}

function Crc32(BufferValue) {
  let Crc = 0xffffffff;
  for (const Byte of BufferValue) {
    Crc ^= Byte;
    for (let Bit = 0; Bit < 8; Bit += 1) {
      Crc = (Crc >>> 1) ^ (0xedb88320 & -(Crc & 1));
    }
  }
  return (Crc ^ 0xffffffff) >>> 0;
}

function UInt16(Value) {
  const BufferValue = Buffer.alloc(2);
  BufferValue.writeUInt16LE(Value);
  return BufferValue;
}

function UInt32(Value) {
  const BufferValue = Buffer.alloc(4);
  BufferValue.writeUInt32LE(Value);
  return BufferValue;
}

function ZipEntry(Entry, Offset) {
  const Data = readFileSync(Entry.Path);
  const NameBuffer = Buffer.from(Entry.Name.replaceAll("\\", "/"));
  const Crc = Crc32(Data);
  const { DatePart, TimePart } = DosDateTime(new Date());
  const Mode = Entry.Mode ?? 0o100644;
  const VersionMadeBy = 0x0314;
  const ExternalAttributes = (Mode << 16) >>> 0;

  const LocalHeader = Buffer.concat([
    UInt32(0x04034b50),
    UInt16(20),
    UInt16(0),
    UInt16(0),
    UInt16(TimePart),
    UInt16(DatePart),
    UInt32(Crc),
    UInt32(Data.length),
    UInt32(Data.length),
    UInt16(NameBuffer.length),
    UInt16(0),
    NameBuffer,
  ]);

  const CentralHeader = Buffer.concat([
    UInt32(0x02014b50),
    UInt16(VersionMadeBy),
    UInt16(20),
    UInt16(0),
    UInt16(0),
    UInt16(TimePart),
    UInt16(DatePart),
    UInt32(Crc),
    UInt32(Data.length),
    UInt32(Data.length),
    UInt16(NameBuffer.length),
    UInt16(0),
    UInt16(0),
    UInt16(0),
    UInt16(0),
    UInt32(ExternalAttributes),
    UInt32(Offset),
    NameBuffer,
  ]);

  return {
    Local: Buffer.concat([LocalHeader, Data]),
    Central: CentralHeader,
  };
}

function WriteZip(OutputPath, Entries) {
  const Locals = [];
  const Centrals = [];
  let Offset = 0;

  for (const Entry of Entries) {
    const Built = ZipEntry(Entry, Offset);
    Locals.push(Built.Local);
    Centrals.push(Built.Central);
    Offset += Built.Local.length;
  }

  const CentralDir = Buffer.concat(Centrals);
  const End = Buffer.concat([
    UInt32(0x06054b50),
    UInt16(0),
    UInt16(0),
    UInt16(Entries.length),
    UInt16(Entries.length),
    UInt32(CentralDir.length),
    UInt32(Offset),
    UInt16(0),
  ]);

  writeFileSync(OutputPath, Buffer.concat([...Locals, CentralDir, End]));
}

function InstallerPath(FileName) {
  return path.join(InstallerDir, FileName);
}

const SetupPayloadEntries = [
  {
    Name: `Payload/${RobloxPluginFileName}`,
    Path: RobloxPluginPath,
  },
  {
    Name: `Payload/${FigmaPluginZipName}`,
    Path: FigmaZipPath,
  },
  {
    Name: "README.txt",
    Path: ReadmePath,
  },
];

rmSync(ReleaseDir, { recursive: true, force: true });
mkdirSync(ReleaseDir, { recursive: true });

Run("npm", ["--prefix", "FigmaPlugin", "run", "build"], Root);
Run("rojo", ["build", "default.project.json", "--output", RobloxPluginPath], path.join(Root, "RobloxPlugin"));

WriteZip(FigmaZipPath, [
  {
    Name: `${FigmaPluginBundleDir}/manifest.json`,
    Path: path.join(Root, "FigmaPlugin", "manifest.json"),
  },
  {
    Name: `${FigmaPluginBundleDir}/build/main.js`,
    Path: path.join(Root, "FigmaPlugin", "build", "main.js"),
  },
  {
    Name: `${FigmaPluginBundleDir}/build/ui.js`,
    Path: path.join(Root, "FigmaPlugin", "build", "ui.js"),
  },
]);

writeFileSync(
  ReadmePath,
  [
    "Figma2Roblox setup",
    "",
    "Windows:",
    `1. Unzip ${WindowsSetupZipName}.`,
    "2. Double-click InstallFigmaToRoblox.cmd.",
    "",
    "macOS:",
    `1. Unzip ${MacSetupZipName}.`,
    "2. Double-click InstallFigmaToRoblox.command.",
    "",
    "After the installer finishes:",
    "1. Open the Figma desktop app.",
    "2. Choose Plugins > Development > Import new plugin from manifest...",
    "3. Select the manifest.json path printed by the installer.",
    "4. Open Roblox Studio.",
    "5. Sign in with the same Roblox account in both FigmaToRoblox plugins.",
    "",
  ].join("\n"),
);

WriteZip(WindowsSetupPath, [
  {
    Name: "InstallFigmaToRoblox.cmd",
    Path: InstallerPath("InstallFigmaToRoblox.cmd"),
  },
  {
    Name: "InstallFigmaToRoblox.ps1",
    Path: InstallerPath("InstallFigmaToRoblox.ps1"),
  },
  ...SetupPayloadEntries,
]);

WriteZip(MacSetupPath, [
  {
    Name: "InstallFigmaToRoblox.command",
    Path: InstallerPath("InstallFigmaToRoblox.command"),
    Mode: 0o100755,
  },
  {
    Name: "InstallFigmaToRoblox.sh",
    Path: InstallerPath("InstallFigmaToRoblox.sh"),
    Mode: 0o100755,
  },
  ...SetupPayloadEntries,
]);

console.log(`\nBuilt release files in ${ReleaseDir}`);
