import { deflateSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Assets = [
  ["BakedCard/Assets/CardPanel.png", 24, 24, [31, 35, 45, 255]],
  ["BakedCard/Assets/HeaderBand.png", 24, 24, [55, 116, 255, 255]],
  ["BakedCard/Assets/TitleText.png", 24, 24, [242, 246, 255, 255]],
  ["BakedCard/Assets/MetricText.png", 24, 24, [121, 226, 183, 255]],
  ["BakedCard/Assets/Badge.png", 24, 24, [255, 196, 87, 255]],
  ["AutoLayoutStack/Assets/Panel.png", 24, 24, [22, 28, 36, 255]],
  ["AutoLayoutStack/Assets/ItemA.png", 24, 24, [217, 80, 64, 255]],
  ["AutoLayoutStack/Assets/ItemB.png", 24, 24, [55, 157, 99, 255]],
  ["AutoLayoutStack/Assets/ItemC.png", 24, 24, [76, 122, 216, 255]],
  ["ButtonsAndScroll/Assets/RootPanel.png", 24, 24, [20, 22, 27, 255]],
  ["ButtonsAndScroll/Assets/ScrollItemA.png", 24, 24, [128, 91, 213, 255]],
  ["ButtonsAndScroll/Assets/ScrollItemB.png", 24, 24, [236, 117, 71, 255]],
  ["ButtonsAndScroll/Assets/CtaButton.png", 24, 24, [53, 189, 134, 255]],
  ["MultiSelectionResponsive/Assets/LeftPanel.png", 24, 24, [226, 88, 93, 255]],
  ["MultiSelectionResponsive/Assets/RightPanel.png", 24, 24, [64, 155, 222, 255]],
];

const CrcTable = new Uint32Array(256);
for (let N = 0; N < 256; N += 1) {
  let C = N;
  for (let K = 0; K < 8; K += 1) {
    C = C & 1 ? 0xedb88320 ^ (C >>> 1) : C >>> 1;
  }
  CrcTable[N] = C >>> 0;
}

function Crc32(BufferValue) {
  let C = 0xffffffff;
  for (const Byte of BufferValue) {
    C = CrcTable[(C ^ Byte) & 0xff] ^ (C >>> 8);
  }
  return (C ^ 0xffffffff) >>> 0;
}

function Chunk(Type, Data) {
  const TypeBytes = Buffer.from(Type, "ascii");
  const Out = Buffer.alloc(12 + Data.length);
  Out.writeUInt32BE(Data.length, 0);
  TypeBytes.copy(Out, 4);
  Data.copy(Out, 8);
  Out.writeUInt32BE(Crc32(Buffer.concat([TypeBytes, Data])), 8 + Data.length);
  return Out;
}

function SolidPng(Width, Height, Color) {
  const Header = Buffer.alloc(13);
  Header.writeUInt32BE(Width, 0);
  Header.writeUInt32BE(Height, 4);
  Header[8] = 8;
  Header[9] = 6;
  Header[10] = 0;
  Header[11] = 0;
  Header[12] = 0;

  const RowLength = 1 + Width * 4;
  const Raw = Buffer.alloc(RowLength * Height);
  for (let Y = 0; Y < Height; Y += 1) {
    const RowOffset = Y * RowLength;
    Raw[RowOffset] = 0;
    for (let X = 0; X < Width; X += 1) {
      const Offset = RowOffset + 1 + X * 4;
      Raw[Offset] = Color[0];
      Raw[Offset + 1] = Color[1];
      Raw[Offset + 2] = Color[2];
      Raw[Offset + 3] = Color[3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Chunk("IHDR", Header),
    Chunk("IDAT", deflateSync(Raw)),
    Chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [RelativePath, Width, Height, Color] of Assets) {
  const Output = path.join(Root, "Fixtures", RelativePath);
  fs.mkdirSync(path.dirname(Output), { recursive: true });
  fs.writeFileSync(Output, SolidPng(Width, Height, Color));
}
