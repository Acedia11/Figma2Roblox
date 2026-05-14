local Text = {}

export type FontFaceProps = {
	Family: string,
	Weight: string?,
	Style: string?,
}

export type TextProps = {
	Text: string?,
	Font: string?,
	FontFace: FontFaceProps?,
	TextSize: number?,
	TextColor: { R: number, G: number, B: number, A: number? }?,
	TextXAlignment: string?,
	TextYAlignment: string?,
	TextWrapped: boolean?,
	RichText: boolean?,
	LineHeight: number?,
	TextScaled: boolean?,
	TextStrokeColor: { R: number, G: number, B: number, A: number? }?,
	TextStrokeTransparency: number?,
	AutomaticSize: string?,
}

local TextColorFallback = Color3.fromRGB(235, 235, 235)
local FallbackFont = Font.fromEnum(Enum.Font.SourceSans)

local WeightMap: { [string]: Enum.FontWeight } = {
	Thin = Enum.FontWeight.Thin,
	ExtraLight = Enum.FontWeight.ExtraLight,
	Light = Enum.FontWeight.Light,
	Regular = Enum.FontWeight.Regular,
	Medium = Enum.FontWeight.Medium,
	SemiBold = Enum.FontWeight.SemiBold,
	Bold = Enum.FontWeight.Bold,
	ExtraBold = Enum.FontWeight.ExtraBold,
	Heavy = Enum.FontWeight.Heavy,
}

local FamilyAssetMap: { [string]: string } = {
	["Montserrat"] = "rbxasset://fonts/families/Montserrat.json",
	["Roboto"] = "rbxasset://fonts/families/Roboto.json",
	["Roboto Condensed"] = "rbxasset://fonts/families/RobotoCondensed.json",
	["Roboto Mono"] = "rbxasset://fonts/families/RobotoMono.json",
	["Nunito"] = "rbxasset://fonts/families/Nunito.json",
	["Oswald"] = "rbxasset://fonts/families/Oswald.json",
	["Merriweather"] = "rbxasset://fonts/families/Merriweather.json",
	["Source Sans Pro"] = "rbxasset://fonts/families/SourceSansPro.json",
	["Builder Sans"] = "rbxasset://fonts/families/BuilderSans.json",
	["Arimo"] = "rbxasset://fonts/families/Arimo.json",
	["Inconsolata"] = "rbxasset://fonts/families/Inconsolata.json",
	["Fredoka One"] = "rbxasset://fonts/families/FredokaOne.json",
	["Highway Gothic"] = "rbxasset://fonts/families/HighwayGothic.json",
	["Sarpanch"] = "rbxasset://fonts/families/Sarpanch.json",
	["Josefin Sans"] = "rbxasset://fonts/families/JosefinSans.json",
	["Jura"] = "rbxasset://fonts/families/Jura.json",
	["Kalam"] = "rbxasset://fonts/families/Kalam.json",
	["Press Start 2P"] = "rbxasset://fonts/families/PressStart2P.json",
	["Bangers"] = "rbxasset://fonts/families/Bangers.json",
	["Special Elite"] = "rbxasset://fonts/families/SpecialElite.json",
	["Permanent Marker"] = "rbxasset://fonts/families/PermanentMarker.json",
	["Indie Flower"] = "rbxasset://fonts/families/IndieFlower.json",
	["Patrick Hand"] = "rbxasset://fonts/families/PatrickHand.json",
	["Comic Neue Angular"] = "rbxasset://fonts/families/ComicNeueAngular.json",
	["Creepster"] = "rbxasset://fonts/families/Creepster.json",
	["Luckiest Guy"] = "rbxasset://fonts/families/LuckiestGuy.json",
	["Michroma"] = "rbxasset://fonts/families/Michroma.json",
	["Titillium Web"] = "rbxasset://fonts/families/TitilliumWeb.json",
	["Ubuntu"] = "rbxasset://fonts/families/Ubuntu.json",
	["Amatic SC"] = "rbxasset://fonts/families/AmaticSC.json",
	["Denk One"] = "rbxasset://fonts/families/DenkOne.json",
	["Fondamento"] = "rbxasset://fonts/families/Fondamento.json",
	["Grenze Gotisch"] = "rbxasset://fonts/families/GrenzeGotisch.json",
	["Noto Sans"] = "rbxasset://fonts/families/NotoSans.json",
}

local function ResolveFontFace(Props: FontFaceProps): Font
	local Weight = WeightMap[Props.Weight or "Regular"] or Enum.FontWeight.Regular
	local Style = if Props.Style == "Italic" then Enum.FontStyle.Italic else Enum.FontStyle.Normal
	local AssetPath = FamilyAssetMap[Props.Family]
	if AssetPath then
		local Ok, Resolved = pcall(Font.new, AssetPath, Weight, Style)
		if Ok and typeof(Resolved) == "Font" then
			return Resolved
		end
	end
	local NameOk, NameResolved = pcall(Font.fromName, Props.Family, Weight, Style)
	if NameOk and typeof(NameResolved) == "Font" then
		return NameResolved
	end
	return FallbackFont
end

local function FontFromName(Name: string?): Font
	if not Name then
		return FallbackFont
	end
	local FoundEnum = (Enum.Font :: any)[Name]
	if typeof(FoundEnum) == "EnumItem" then
		return Font.fromEnum(FoundEnum)
	end
	return FallbackFont
end

local function XAlignFromName(Name: string?): Enum.TextXAlignment
	if Name == "Left" then return Enum.TextXAlignment.Left end
	if Name == "Right" then return Enum.TextXAlignment.Right end
	return Enum.TextXAlignment.Center
end

local function YAlignFromName(Name: string?): Enum.TextYAlignment
	if Name == "Top" then return Enum.TextYAlignment.Top end
	if Name == "Bottom" then return Enum.TextYAlignment.Bottom end
	return Enum.TextYAlignment.Center
end

local function AutomaticSizeFromName(Name: string?): Enum.AutomaticSize
	if Name == "X" then return Enum.AutomaticSize.X end
	if Name == "Y" then return Enum.AutomaticSize.Y end
	if Name == "XY" then return Enum.AutomaticSize.XY end
	return Enum.AutomaticSize.None
end

function Text.Create(Kind: string): Instance
	if Kind == "TextLabel" then
		local Element = Instance.new("TextLabel")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		return Element
	elseif Kind == "TextButton" then
		local Element = Instance.new("TextButton")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		Element.AutoButtonColor = false
		return Element
	elseif Kind == "TextBox" then
		local Element = Instance.new("TextBox")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		Element.ClearTextOnFocus = false
		return Element
	end
	error("Text.Create called with unsupported Kind: " .. tostring(Kind))
end

function Text.Apply(Element: Instance, Props: TextProps?): ()
	if not Props then
		return
	end
	if not (Element:IsA("TextLabel") or Element:IsA("TextButton") or Element:IsA("TextBox")) then
		return
	end
	local Casted = Element :: any
	Casted.Text = Props.Text or ""
	if Props.FontFace then
		Casted.FontFace = ResolveFontFace(Props.FontFace)
	else
		Casted.FontFace = FontFromName(Props.Font)
	end
	Casted.TextSize = Props.TextSize or 14
	Casted.TextWrapped = Props.TextWrapped ~= false
	Casted.RichText = Props.RichText == true
	Casted.TextScaled = Props.TextScaled == true
	Casted.TextXAlignment = XAlignFromName(Props.TextXAlignment)
	Casted.TextYAlignment = YAlignFromName(Props.TextYAlignment)
	Casted.AutomaticSize = AutomaticSizeFromName(Props.AutomaticSize)
	if Props.TextColor then
		Casted.TextColor3 = Color3.new(Props.TextColor.R, Props.TextColor.G, Props.TextColor.B)
		Casted.TextTransparency = 1 - (Props.TextColor.A or 1)
	else
		Casted.TextColor3 = TextColorFallback
	end
	if Props.TextStrokeColor then
		Casted.TextStrokeColor3 = Color3.new(Props.TextStrokeColor.R, Props.TextStrokeColor.G, Props.TextStrokeColor.B)
		Casted.TextStrokeTransparency = Props.TextStrokeTransparency or (1 - (Props.TextStrokeColor.A or 1))
	end
	if Props.LineHeight then
		Casted.LineHeight = Props.LineHeight
	end
end

return Text
