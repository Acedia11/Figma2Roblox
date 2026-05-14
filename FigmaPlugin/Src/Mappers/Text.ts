import type { Color, FontFaceProps, TextProps } from "../Types";
import { ColorFromFirstSolidFill } from "./Fills";

const FamilyMap: Record<string, string> = {
  "Montserrat": "Montserrat",
  "Roboto": "Roboto",
  "Roboto Condensed": "Roboto Condensed",
  "Roboto Mono": "Roboto Mono",
  "Nunito": "Nunito",
  "Oswald": "Oswald",
  "Merriweather": "Merriweather",
  "Source Sans Pro": "Source Sans Pro",
  "Source Sans 3": "Source Sans Pro",
  "Source Sans": "Source Sans Pro",
  "Builder Sans": "Builder Sans",
  "Arimo": "Arimo",
  "Inconsolata": "Inconsolata",
  "Fredoka One": "Fredoka One",
  "Fredoka": "Fredoka One",
  "Highway Gothic": "Highway Gothic",
  "Sarpanch": "Sarpanch",
  "Josefin Sans": "Josefin Sans",
  "Jura": "Jura",
  "Kalam": "Kalam",
  "Press Start 2P": "Press Start 2P",
  "Bangers": "Bangers",
  "Special Elite": "Special Elite",
  "Permanent Marker": "Permanent Marker",
  "Indie Flower": "Indie Flower",
  "Patrick Hand": "Patrick Hand",
  "Comic Neue": "Comic Neue Angular",
  "Comic Neue Angular": "Comic Neue Angular",
  "Creepster": "Creepster",
  "Luckiest Guy": "Luckiest Guy",
  "Michroma": "Michroma",
  "Titillium Web": "Titillium Web",
  "Ubuntu": "Ubuntu",
  "Zekton": "Zekton",
  "Noto Sans": "Noto Sans",
  "Inter": "Montserrat",
  "Gotham": "Montserrat",
  "SF Pro": "Montserrat",
  "SF Pro Display": "Montserrat",
  "SF Pro Text": "Montserrat",
  "Helvetica": "Arimo",
  "Helvetica Neue": "Arimo",
  "Arial": "Arimo",
  "Garamond": "Merriweather",
  "Times New Roman": "Merriweather",
  "Times": "Merriweather",
  "Georgia": "Merriweather",
  "SF Mono": "Roboto Mono",
  "JetBrains Mono": "Roboto Mono",
  "Fira Code": "Roboto Mono",
  "Source Code Pro": "Roboto Mono",
  "Courier New": "Roboto Mono",
  "Courier": "Roboto Mono",
  "Consolas": "Roboto Mono",
  "Monaco": "Roboto Mono",
  "Cartoon": "Comic Neue Angular",
};

function ResolveFamily(Family: string): string {
  return FamilyMap[Family] ?? "Montserrat";
}

function ParseStyle(StyleString: string): { Weight: string; Italic: boolean } {
  const Lower = StyleString.toLowerCase();
  const Italic = Lower.includes("italic") || Lower.includes("oblique");
  let Weight: string = "Regular";
  if (Lower.includes("thin") || Lower.includes("hairline")) Weight = "Thin";
  else if (Lower.includes("extralight") || Lower.includes("extra light") || Lower.includes("ultralight") || Lower.includes("ultra light")) Weight = "ExtraLight";
  else if (Lower.includes("semibold") || Lower.includes("semi bold") || Lower.includes("demibold") || Lower.includes("demi bold") || Lower.includes("demi")) Weight = "SemiBold";
  else if (Lower.includes("extrabold") || Lower.includes("extra bold") || Lower.includes("ultrabold") || Lower.includes("ultra bold")) Weight = "ExtraBold";
  else if (Lower.includes("black") || Lower.includes("heavy")) Weight = "Heavy";
  else if (Lower.includes("bold")) Weight = "Bold";
  else if (Lower.includes("medium")) Weight = "Medium";
  else if (Lower.includes("light")) Weight = "Light";
  return { Weight, Italic };
}

function ResolveFontFace(FontName: { family: string; style: string }): FontFaceProps {
  const Family = ResolveFamily(FontName.family);
  const { Weight, Italic } = ParseStyle(FontName.style);
  const Out: FontFaceProps = { Family };
  if (Weight !== "Regular") Out.Weight = Weight;
  if (Italic) Out.Style = "Italic";
  return Out;
}

function ToTextXAlignment(V: TextNode["textAlignHorizontal"]): "Left" | "Center" | "Right" {
  if (V === "CENTER") return "Center";
  if (V === "RIGHT") return "Right";
  return "Left";
}

function ToTextYAlignment(V: TextNode["textAlignVertical"]): "Top" | "Center" | "Bottom" {
  if (V === "CENTER") return "Center";
  if (V === "BOTTOM") return "Bottom";
  return "Top";
}

function ToAutomaticSize(V: TextNode["textAutoResize"]): "None" | "X" | "Y" | "XY" {
  if (V === "WIDTH_AND_HEIGHT") return "XY";
  if (V === "HEIGHT") return "Y";
  if (V === "TRUNCATE") return "None";
  return "None";
}

function ApplyTextCase(Text: string, Case: TextNode["textCase"] | typeof figma.mixed): string {
  if (Case === figma.mixed) return Text;
  if (Case === "UPPER") return Text.toUpperCase();
  if (Case === "LOWER") return Text.toLowerCase();
  if (Case === "TITLE") return Text.replace(/\w\S*/g, (Word) => Word[0]!.toUpperCase() + Word.slice(1).toLowerCase());
  return Text;
}

function EscapeRichText(Raw: string): string {
  return Raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ColorToRgb(C: Color): string {
  const R = Math.round(C.R * 255);
  const G = Math.round(C.G * 255);
  const B = Math.round(C.B * 255);
  return `rgb(${R},${G},${B})`;
}

function CaseSegment(Characters: string, Case: string | symbol): string {
  if (Case === "UPPER") return Characters.toUpperCase();
  if (Case === "LOWER") return Characters.toLowerCase();
  if (Case === "TITLE") return Characters.replace(/\w\S*/g, (Word) => Word[0]!.toUpperCase() + Word.slice(1).toLowerCase());
  return Characters;
}

type Segment = {
  characters: string;
  fontName: { family: string; style: string };
  fontSize: number;
  fontWeight: number;
  textCase: TextNode["textCase"];
  textDecoration: TextNode["textDecoration"];
  fills: ReadonlyArray<Paint>;
};

function BuildRichText(Segments: ReadonlyArray<Segment>, BaseSize: number, BaseColor: Color | undefined): string {
  const Parts: string[] = [];
  for (const Seg of Segments) {
    const FontInfo = ResolveFontFace(Seg.fontName);
    const Bold = FontInfo.Weight === "Bold" || FontInfo.Weight === "Heavy" || FontInfo.Weight === "ExtraBold" || FontInfo.Weight === "SemiBold";
    const Italic = FontInfo.Style === "Italic";
    const Underline = Seg.textDecoration === "UNDERLINE";
    const Strike = Seg.textDecoration === "STRIKETHROUGH";
    const SegColor = ColorFromFirstSolidFill(Seg.fills);
    const Cased = CaseSegment(Seg.characters, Seg.textCase);
    let Inner = EscapeRichText(Cased);

    const NeedsFontTag = Math.round(Seg.fontSize) !== Math.round(BaseSize)
      || (SegColor && BaseColor && (SegColor.R !== BaseColor.R || SegColor.G !== BaseColor.G || SegColor.B !== BaseColor.B))
      || (SegColor && !BaseColor);
    if (NeedsFontTag) {
      const Attrs: string[] = [];
      if (SegColor) Attrs.push(`color="${ColorToRgb(SegColor)}"`);
      if (Math.round(Seg.fontSize) !== Math.round(BaseSize)) Attrs.push(`size="${Math.round(Seg.fontSize)}"`);
      Inner = `<font ${Attrs.join(" ")}>${Inner}</font>`;
    }
    if (Bold) Inner = `<b>${Inner}</b>`;
    if (Italic) Inner = `<i>${Inner}</i>`;
    if (Underline) Inner = `<u>${Inner}</u>`;
    if (Strike) Inner = `<s>${Inner}</s>`;

    Parts.push(Inner);
  }
  return Parts.join("");
}

function HasMixedStyle(Segments: ReadonlyArray<Segment>): boolean {
  if (Segments.length <= 1) return false;
  const First = Segments[0]!;
  for (let I = 1; I < Segments.length; I++) {
    const S = Segments[I]!;
    if (S.fontName.family !== First.fontName.family) return true;
    if (S.fontName.style !== First.fontName.style) return true;
    if (Math.round(S.fontSize) !== Math.round(First.fontSize)) return true;
    if (S.textDecoration !== First.textDecoration) return true;
    const FirstColor = ColorFromFirstSolidFill(First.fills);
    const SColor = ColorFromFirstSolidFill(S.fills);
    if ((!!FirstColor) !== (!!SColor)) return true;
    if (FirstColor && SColor && (FirstColor.R !== SColor.R || FirstColor.G !== SColor.G || FirstColor.B !== SColor.B)) return true;
  }
  return false;
}

function HasAnyDecoration(Segments: ReadonlyArray<Segment>): boolean {
  for (const S of Segments) {
    if (S.textDecoration === "UNDERLINE" || S.textDecoration === "STRIKETHROUGH") return true;
  }
  return false;
}

export function MapText(Node: TextNode): TextProps {
  const Out: TextProps = {};

  const Segments = Node.getStyledTextSegments([
    "fontName",
    "fontSize",
    "fontWeight",
    "fills",
    "textCase",
    "textDecoration",
  ]) as unknown as Segment[];

  Out.TextSize = typeof Node.fontSize === "number" ? Math.round(Node.fontSize) : (Segments[0] ? Math.round(Segments[0].fontSize) : 14);

  Out.TextXAlignment = ToTextXAlignment(Node.textAlignHorizontal);
  Out.TextYAlignment = ToTextYAlignment(Node.textAlignVertical);
  Out.TextWrapped = Node.textAutoResize !== "WIDTH_AND_HEIGHT";
  Out.AutomaticSize = ToAutomaticSize(Node.textAutoResize);

  if (typeof Node.lineHeight === "object" && "unit" in Node.lineHeight) {
    if (Node.lineHeight.unit === "PIXELS" && typeof Node.fontSize === "number" && Node.fontSize > 0) {
      Out.LineHeight = Number((Node.lineHeight.value / Node.fontSize).toFixed(3));
    } else if (Node.lineHeight.unit === "PERCENT") {
      Out.LineHeight = Number((Node.lineHeight.value / 100).toFixed(3));
    }
  }

  const PrimaryFont = typeof Node.fontName === "object" && "family" in Node.fontName ? Node.fontName : (Segments[0]?.fontName ?? null);
  if (PrimaryFont) {
    Out.FontFace = ResolveFontFace(PrimaryFont);
  }

  const PrimaryColor = ColorFromFirstSolidFill(Node.fills);
  if (PrimaryColor) Out.TextColor = PrimaryColor;

  const Mixed = HasMixedStyle(Segments);
  const HasDecoration = HasAnyDecoration(Segments);

  if (Mixed || HasDecoration) {
    const Body = BuildRichText(Segments, Out.TextSize, PrimaryColor);
    Out.Text = Body;
    Out.RichText = true;
  } else {
    const Case = Node.textCase;
    Out.Text = ApplyTextCase(Node.characters, Case);
  }

  return Out;
}
