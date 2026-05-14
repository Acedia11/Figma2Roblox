local MontserratPath = "rbxasset://fonts/families/Montserrat.json"

return {
	Colors = {
		Bg = Color3.fromRGB(9, 9, 11),
		Card = Color3.fromRGB(24, 24, 27),
		CardElevated = Color3.fromRGB(39, 39, 42),
		Hairline = Color3.fromRGB(63, 63, 70),
		HairlineTransparency = 0.55,
		HairlineStrong = Color3.fromRGB(82, 82, 91),
		HairlineStrongTransparency = 0.3,

		TextPrimary = Color3.fromRGB(250, 250, 250),
		TextSecondary = Color3.fromRGB(161, 161, 170),
		TextMuted = Color3.fromRGB(113, 113, 122),
		TextDim = Color3.fromRGB(82, 82, 91),

		Accent = Color3.fromRGB(248, 113, 113),
		AccentHover = Color3.fromRGB(252, 142, 142),
		AccentDeep = Color3.fromRGB(220, 80, 80),
		AccentInk = Color3.fromRGB(15, 8, 8),

		Connected = Color3.fromRGB(16, 185, 129),
		Pending = Color3.fromRGB(251, 191, 36),
		Disconnected = Color3.fromRGB(239, 68, 68),
		Error = Color3.fromRGB(248, 113, 113),
		ErrorBg = Color3.fromRGB(28, 16, 18),
	},
	Fonts = {
		Display = Font.new(MontserratPath, Enum.FontWeight.Bold),
		DisplaySemi = Font.new(MontserratPath, Enum.FontWeight.SemiBold),
		Body = Font.new(MontserratPath, Enum.FontWeight.Medium),
		BodyRegular = Font.new(MontserratPath, Enum.FontWeight.Regular),
		Mono = Font.new(MontserratPath, Enum.FontWeight.Regular),
	},
	Sizes = {
		LabelTiny = 10,
		LabelSmall = 11,
		LabelMedium = 12,
		Body = 13,
		BodyLarge = 14,
		Title = 15,
		Numeral = 22,
		NumeralLarge = 28,
	},
	Spacing = {
		Tight = 4,
		Item = 10,
		InGroup = 14,
		Pad = 20,
		Section = 22,
		Group = 28,
	},
	Radius = {
		Small = 6,
		Medium = 8,
		Large = 10,
		Pill = 100,
	},
	Motion = {
		Hover = 0.14,
	},
}
