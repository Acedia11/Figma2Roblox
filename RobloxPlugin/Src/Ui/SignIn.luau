local Theme = require(script.Parent.Theme)
local Helpers = require(script.Parent.Helpers)

local SignIn = {}

export type Callbacks = {
	OnSignIn: () -> (),
	OnSignOut: () -> (),
	OnCancel: () -> (),
}

export type Mode = "SignedOut" | "AwaitingPaste" | "SignedIn"

export type SignInView = {
	Element: Frame,
	SetMode: (Mode: Mode, Url: string?, UserName: string?) -> (),
}

local function CreateStep(Number: string, Title: string, Body: string, Parent: Instance, Order: number): Frame
	local Row = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = Order,
	}, Parent)
	Helpers.HStack(12, Row)

	Helpers.StepNumeral(Number, Row).LayoutOrder = 1

	local TextCol = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, -34, 0, 0),
		LayoutOrder = 2,
	}, Row)
	Helpers.VStack(2, TextCol)

	Helpers.Label(Title, {
		FontFace = Theme.Fonts.DisplaySemi,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.TextPrimary,
		LayoutOrder = 1,
	}, TextCol)

	Helpers.Label(Body, {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.TextMuted,
		TextWrapped = true,
		LayoutOrder = 2,
	}, TextCol)

	return Row
end

function SignIn.Create(Parent: Instance, Callbacks: Callbacks): SignInView
	local Container = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	}, Parent)
	Helpers.VStack(Theme.Spacing.Item, Container)

	local SignedOutSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 1,
	}, Container)
	Helpers.VStack(Theme.Spacing.Item, SignedOutSection)

	local SignInButton = Helpers.Button("Sign in with Roblox", "Accent", SignedOutSection)
	SignInButton.LayoutOrder = 1
	SignInButton.MouseButton1Click:Connect(Callbacks.OnSignIn)

	local AwaitingSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 2,
		Visible = false,
	}, Container)
	Helpers.VStack(Theme.Spacing.InGroup, AwaitingSection)

	local UrlBoxOuter = Helpers.Frame({
		BackgroundColor3 = Theme.Colors.Card,
		BackgroundTransparency = 0,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 1,
	}, AwaitingSection)
	Helpers.PaddingXY(12, 10, UrlBoxOuter)
	Helpers.Corner(Theme.Radius.Medium, UrlBoxOuter)
	local UrlBoxStroke = Instance.new("UIStroke")
	UrlBoxStroke.Color = Theme.Colors.Hairline
	UrlBoxStroke.Transparency = 0.4
	UrlBoxStroke.Thickness = 1
	UrlBoxStroke.Parent = UrlBoxOuter

	local UrlBox = Instance.new("TextBox")
	UrlBox.BackgroundTransparency = 1
	UrlBox.BorderSizePixel = 0
	UrlBox.TextEditable = false
	UrlBox.ClearTextOnFocus = false
	UrlBox.MultiLine = true
	UrlBox.TextWrapped = true
	UrlBox.FontFace = Theme.Fonts.BodyRegular
	UrlBox.TextSize = 11
	UrlBox.TextColor3 = Theme.Colors.TextPrimary
	UrlBox.TextXAlignment = Enum.TextXAlignment.Left
	UrlBox.TextYAlignment = Enum.TextYAlignment.Top
	UrlBox.AutomaticSize = Enum.AutomaticSize.Y
	UrlBox.Size = UDim2.new(1, 0, 0, 0)
	UrlBox.Text = ""
	UrlBox.Parent = UrlBoxOuter

	Helpers.Label("Auto-selected · Ctrl+C to copy", {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelSmall,
		TextColor3 = Theme.Colors.TextMuted,
		LayoutOrder = 2,
	}, AwaitingSection)

	local StepsBlock = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 3,
	}, AwaitingSection)
	Helpers.VStack(Theme.Spacing.InGroup, StepsBlock)

	CreateStep("01", "Paste in browser", "Open a new tab, paste the URL above, sign in.", StepsBlock, 1)
	CreateStep("02", "Approve scopes", "Allow profile + asset access for FigmaToRoblox.", StepsBlock, 2)
	CreateStep("03", "Return here", "Token will appear automatically.", StepsBlock, 3)

	local CancelButton = Helpers.Button("Cancel", nil, AwaitingSection)
	CancelButton.LayoutOrder = 4
	CancelButton.MouseButton1Click:Connect(Callbacks.OnCancel)

	local SignedInSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 3,
		Visible = false,
	}, Container)
	Helpers.VStack(Theme.Spacing.Item, SignedInSection)

	local UserCard = Helpers.Card(SignedInSection)
	UserCard.LayoutOrder = 1
	Helpers.PaddingXY(14, 12, UserCard)
	local UserStack = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	}, UserCard)
	Helpers.VStack(2, UserStack)

	Helpers.Label("Signed in as", {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelSmall,
		TextColor3 = Theme.Colors.TextMuted,
		LayoutOrder = 1,
	}, UserStack)

	local UserLabel = Helpers.Label("", {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.Title,
		TextColor3 = Theme.Colors.TextPrimary,
		LayoutOrder = 2,
	}, UserStack)

	local SignOutButton = Helpers.Button("Sign out", nil, SignedInSection)
	SignOutButton.LayoutOrder = 2
	SignOutButton.MouseButton1Click:Connect(Callbacks.OnSignOut)

	local function SelectAllInUrlBox(): ()
		UrlBox:CaptureFocus()
		UrlBox.SelectionStart = 1
		UrlBox.CursorPosition = #UrlBox.Text + 1
	end

	UrlBox.Focused:Connect(function()
		UrlBox.SelectionStart = 1
		UrlBox.CursorPosition = #UrlBox.Text + 1
	end)

	local View: SignInView = {
		Element = Container,
		SetMode = function(Mode: Mode, Url: string?, UserName: string?)
			SignedOutSection.Visible = Mode == "SignedOut"
			AwaitingSection.Visible = Mode == "AwaitingPaste"
			SignedInSection.Visible = Mode == "SignedIn"
			if Mode == "AwaitingPaste" and Url then
				UrlBox.Text = Url
				task.defer(SelectAllInUrlBox)
			end
			if Mode == "SignedIn" and UserName then
				UserLabel.Text = UserName
			end
		end,
	}

	return View
end

return SignIn
