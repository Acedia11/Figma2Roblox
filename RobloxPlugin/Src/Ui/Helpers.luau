local TweenService = game:GetService("TweenService")
local Theme = require(script.Parent.Theme)

local Helpers = {}

local function ApplyProps(Inst: Instance, Props: { [string]: any }?): ()
	if not Props then
		return
	end
	for K, V in pairs(Props) do
		(Inst :: any)[K] = V
	end
end

function Helpers.Frame(Props: { [string]: any }?, Parent: Instance?): Frame
	local F = Instance.new("Frame")
	F.BackgroundTransparency = 1
	F.BorderSizePixel = 0
	ApplyProps(F, Props)
	if Parent then
		F.Parent = Parent
	end
	return F
end

function Helpers.Label(Text: string, Props: { [string]: any }?, Parent: Instance?): TextLabel
	local L = Instance.new("TextLabel")
	L.BackgroundTransparency = 1
	L.BorderSizePixel = 0
	L.Text = Text
	L.FontFace = Theme.Fonts.Body
	L.TextSize = Theme.Sizes.Body
	L.TextColor3 = Theme.Colors.TextPrimary
	L.TextXAlignment = Enum.TextXAlignment.Left
	L.TextYAlignment = Enum.TextYAlignment.Center
	L.RichText = true
	L.AutomaticSize = Enum.AutomaticSize.Y
	L.Size = UDim2.new(1, 0, 0, 0)
	ApplyProps(L, Props)
	if Parent then
		L.Parent = Parent
	end
	return L
end

function Helpers.SectionLabel(Text: string, Parent: Instance?): TextLabel
	return Helpers.Label(string.upper(Text), {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.LabelSmall,
		TextColor3 = Theme.Colors.TextMuted,
		Size = UDim2.new(1, 0, 0, 14),
	}, Parent)
end

function Helpers.StepNumeral(Text: string, Parent: Instance?): TextLabel
	return Helpers.Label(Text, {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.Accent,
		Size = UDim2.new(0, 22, 1, 0),
	}, Parent)
end

function Helpers.Numeral(Text: string, Parent: Instance?): TextLabel
	return Helpers.Label(Text, {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.NumeralLarge,
		TextColor3 = Theme.Colors.TextPrimary,
		Size = UDim2.new(1, 0, 0, 34),
	}, Parent)
end

function Helpers.Hairline(Parent: Instance?, Strong: boolean?): Frame
	return Helpers.Frame({
		Size = UDim2.new(1, 0, 0, 1),
		BackgroundTransparency = if Strong then Theme.Colors.HairlineStrongTransparency else Theme.Colors.HairlineTransparency,
		BackgroundColor3 = if Strong then Theme.Colors.HairlineStrong else Theme.Colors.Hairline,
	}, Parent)
end

function Helpers.VStack(Padding: number, Parent: Instance?): UIListLayout
	local L = Instance.new("UIListLayout")
	L.FillDirection = Enum.FillDirection.Vertical
	L.SortOrder = Enum.SortOrder.LayoutOrder
	L.Padding = UDim.new(0, Padding)
	L.Parent = Parent
	return L
end

function Helpers.HStack(Padding: number, Parent: Instance?): UIListLayout
	local L = Instance.new("UIListLayout")
	L.FillDirection = Enum.FillDirection.Horizontal
	L.SortOrder = Enum.SortOrder.LayoutOrder
	L.Padding = UDim.new(0, Padding)
	L.VerticalAlignment = Enum.VerticalAlignment.Center
	L.Parent = Parent
	return L
end

function Helpers.Padding(All: number, Parent: Instance?): UIPadding
	local P = Instance.new("UIPadding")
	P.PaddingTop = UDim.new(0, All)
	P.PaddingBottom = UDim.new(0, All)
	P.PaddingLeft = UDim.new(0, All)
	P.PaddingRight = UDim.new(0, All)
	P.Parent = Parent
	return P
end

function Helpers.PaddingXY(X: number, Y: number, Parent: Instance?): UIPadding
	local P = Instance.new("UIPadding")
	P.PaddingTop = UDim.new(0, Y)
	P.PaddingBottom = UDim.new(0, Y)
	P.PaddingLeft = UDim.new(0, X)
	P.PaddingRight = UDim.new(0, X)
	P.Parent = Parent
	return P
end

function Helpers.Corner(Radius: number, Parent: Instance?): UICorner
	local C = Instance.new("UICorner")
	C.CornerRadius = UDim.new(0, Radius)
	if Parent then
		C.Parent = Parent
	end
	return C
end

local function TweenColor(Inst: Instance, Property: string, Color: Color3): ()
	TweenService:Create(
		Inst,
		TweenInfo.new(Theme.Motion.Hover, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ [Property] = Color }
	):Play()
end

function Helpers.Button(Label: string, Variant: string?, Parent: Instance?): TextButton
	local IsAccent = Variant == "Accent"
	local IsGhost = not IsAccent

	local B = Instance.new("TextButton")
	B.BackgroundColor3 = if IsAccent then Theme.Colors.Accent else Theme.Colors.Card
	B.BackgroundTransparency = 0
	B.BorderSizePixel = 0
	B.AutoButtonColor = false
	B.Text = Label
	B.FontFace = Theme.Fonts.DisplaySemi
	B.TextSize = Theme.Sizes.Body
	B.TextColor3 = if IsAccent then Theme.Colors.AccentInk else Theme.Colors.TextSecondary
	B.Size = UDim2.new(1, 0, 0, 38)
	Helpers.Corner(Theme.Radius.Medium, B)

	if IsGhost then
		local Stroke = Instance.new("UIStroke")
		Stroke.Color = Theme.Colors.Hairline
		Stroke.Transparency = 0.4
		Stroke.Thickness = 1
		Stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
		Stroke.Parent = B
		B.MouseEnter:Connect(function()
			TweenColor(B, "BackgroundColor3", Theme.Colors.CardElevated)
			TweenColor(B, "TextColor3", Theme.Colors.TextPrimary)
			TweenColor(Stroke, "Color", Theme.Colors.HairlineStrong)
		end)
		B.MouseLeave:Connect(function()
			TweenColor(B, "BackgroundColor3", Theme.Colors.Card)
			TweenColor(B, "TextColor3", Theme.Colors.TextSecondary)
			TweenColor(Stroke, "Color", Theme.Colors.Hairline)
		end)
	else
		B.MouseEnter:Connect(function()
			TweenColor(B, "BackgroundColor3", Theme.Colors.AccentHover)
		end)
		B.MouseLeave:Connect(function()
			TweenColor(B, "BackgroundColor3", Theme.Colors.Accent)
		end)
	end

	if Parent then
		B.Parent = Parent
	end
	return B
end

function Helpers.StatusDot(Color: Color3, Parent: Instance?): Frame
	local Dot = Helpers.Frame({
		Size = UDim2.new(0, 8, 0, 8),
		BackgroundColor3 = Color,
		BackgroundTransparency = 0,
	}, Parent)
	Helpers.Corner(Theme.Radius.Pill, Dot)
	return Dot
end

function Helpers.BrandMark(Parent: Instance?): Frame
	local Group = Helpers.Frame({
		Size = UDim2.new(0, 16, 0, 12),
		BackgroundTransparency = 1,
	}, Parent)
	local Top = Helpers.Frame({
		Size = UDim2.new(0, 11, 0, 4),
		Position = UDim2.new(0, 0, 0, 0),
		BackgroundColor3 = Theme.Colors.Accent,
		BackgroundTransparency = 0,
	}, Group)
	Helpers.Corner(2, Top)
	local Bottom = Helpers.Frame({
		Size = UDim2.new(0, 16, 0, 4),
		Position = UDim2.new(0, 0, 0, 7),
		BackgroundColor3 = Theme.Colors.TextSecondary,
		BackgroundTransparency = 0,
	}, Group)
	Helpers.Corner(2, Bottom)
	return Group
end

function Helpers.Card(Parent: Instance?, Props: { [string]: any }?): Frame
	local C = Helpers.Frame({
		BackgroundColor3 = Theme.Colors.Card,
		BackgroundTransparency = 0,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	}, Parent)
	Helpers.Corner(Theme.Radius.Large, C)
	ApplyProps(C, Props)
	return C
end

function Helpers.ErrorBox(Message: string, Parent: Instance?): Frame
	local Box = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		BackgroundColor3 = Theme.Colors.ErrorBg,
		BackgroundTransparency = 0,
	}, Parent)
	Helpers.PaddingXY(12, 10, Box)
	Helpers.Corner(Theme.Radius.Medium, Box)
	local Stroke = Instance.new("UIStroke")
	Stroke.Color = Theme.Colors.Error
	Stroke.Transparency = 0.55
	Stroke.Thickness = 1
	Stroke.Parent = Box

	Helpers.Label(Message, {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.Error,
		TextWrapped = true,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	}, Box)
	return Box
end

return Helpers
