local Theme = require(script.Parent.Theme)
local Helpers = require(script.Parent.Helpers)
local Status = require(script.Parent.Status)
local SignIn = require(script.Parent.SignIn)

local DockGui = {}

export type Callbacks = {
	OnSignIn: () -> (),
	OnSignOut: () -> (),
	OnCancelSignIn: () -> (),
	OnForceResync: () -> (),
	OnToggleSync: () -> (),
	OnDismissOnboarding: () -> (),
}

export type SyncStats = {
	TimestampLabel: string,
	NodeCount: number,
	ImageCount: number,
}

export type DockView = {
	Widget: DockWidgetPluginGui,
	SetStatus: (State: Status.State, Detail: string?) -> (),
	SetSignInMode: (Mode: SignIn.Mode, Url: string?, UserName: string?) -> (),
	SetSyncStats: (Stats: SyncStats?) -> (),
	SetTarget: (Name: string) -> (),
	SetSyncEnabled: (Enabled: boolean) -> (),
	ShowError: (Message: string?) -> (),
	SetOnboardingVisible: (Visible: boolean) -> (),
}

local function CreateScrollingHost(Parent: Instance): ScrollingFrame
	local Scroll = Instance.new("ScrollingFrame")
	Scroll.Size = UDim2.new(1, 0, 1, 0)
	Scroll.BackgroundColor3 = Theme.Colors.Bg
	Scroll.BackgroundTransparency = 0
	Scroll.BorderSizePixel = 0
	Scroll.ScrollBarThickness = 4
	Scroll.ScrollBarImageColor3 = Theme.Colors.TextDim
	Scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
	Scroll.CanvasSize = UDim2.new(0, 0, 0, 0)
	Scroll.ScrollingDirection = Enum.ScrollingDirection.Y
	Scroll.Parent = Parent
	return Scroll
end

function DockGui.Create(P: Plugin, Callbacks: Callbacks): DockView
	local WidgetInfo = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Right,
		false,
		false,
		340,
		560,
		300,
		440
	)
	local Widget = P:CreateDockWidgetPluginGuiAsync("FigmaToRobloxDock", WidgetInfo)
	Widget.Title = "FigmaToRoblox"
	Widget.Name = "FigmaToRobloxDock"
	Widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

	local Background = Helpers.Frame({
		Size = UDim2.new(1, 0, 1, 0),
		BackgroundColor3 = Theme.Colors.Bg,
		BackgroundTransparency = 0,
	}, Widget)

	local Scroll = CreateScrollingHost(Background)

	local Inner = Helpers.Frame({
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
	}, Scroll)
	Helpers.Padding(Theme.Spacing.Pad, Inner)
	Helpers.VStack(Theme.Spacing.Section, Inner)

	local Onboarding = Helpers.Card(Inner)
	Onboarding.LayoutOrder = 0
	Onboarding.Visible = false
	Helpers.PaddingXY(14, 12, Onboarding)
	Helpers.VStack(10, Onboarding)
	Helpers.Label("Welcome", {
		FontFace = Theme.Fonts.DisplaySemi,
		TextSize = Theme.Sizes.BodyLarge,
		TextColor3 = Theme.Colors.TextPrimary,
		LayoutOrder = 1,
	}, Onboarding)
	Helpers.Label(
		"1. Sign in below.\n2. Open the Figma plugin and sign in with the same Roblox account.\n3. Click Sync.",
		{
			FontFace = Theme.Fonts.BodyRegular,
			TextSize = Theme.Sizes.LabelMedium,
			TextColor3 = Theme.Colors.TextSecondary,
			TextWrapped = true,
			AutomaticSize = Enum.AutomaticSize.Y,
			Size = UDim2.new(1, 0, 0, 0),
			LayoutOrder = 2,
		},
		Onboarding
	)
	local DismissBtn = Helpers.Button("Got it", "Accent", Onboarding)
	DismissBtn.LayoutOrder = 3
	DismissBtn.MouseButton1Click:Connect(Callbacks.OnDismissOnboarding)

	local TitleRow = Helpers.Frame({
		Size = UDim2.new(1, 0, 0, 18),
		LayoutOrder = 1,
	}, Inner)
	Helpers.HStack(10, TitleRow)
	local MarkHolder = Helpers.Frame({
		Size = UDim2.new(0, 16, 0, 18),
		LayoutOrder = 1,
	}, TitleRow)
	local Mark = Helpers.BrandMark(MarkHolder)
	Mark.Position = UDim2.new(0, 0, 0.5, -6)

	Helpers.Label("Figma  →  Roblox", {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.Title,
		TextColor3 = Theme.Colors.TextPrimary,
		Size = UDim2.new(1, -26, 1, 0),
		LayoutOrder = 2,
	}, TitleRow)

	Helpers.Hairline(Inner).LayoutOrder = 2

	local StatusView = Status.Create(Inner)
	StatusView.Element.LayoutOrder = 3

	Helpers.Hairline(Inner).LayoutOrder = 4

	local SignInView = SignIn.Create(Inner, {
		OnSignIn = Callbacks.OnSignIn,
		OnSignOut = Callbacks.OnSignOut,
		OnCancel = Callbacks.OnCancelSignIn,
	})
	SignInView.Element.LayoutOrder = 5

	local ConnectedSections = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 6,
		Visible = false,
	}, Inner)
	Helpers.VStack(Theme.Spacing.Section, ConnectedSections)

	local ToggleSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 0,
	}, ConnectedSections)
	Helpers.VStack(Theme.Spacing.Item, ToggleSection)
	Helpers.SectionLabel("Sync", ToggleSection)
	local ToggleButton = Helpers.Button("Enable sync to this place", "Accent", ToggleSection)
	ToggleButton.LayoutOrder = 2
	ToggleButton.MouseButton1Click:Connect(Callbacks.OnToggleSync)

	Helpers.Hairline(ConnectedSections).LayoutOrder = 1

	local SyncSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 2,
	}, ConnectedSections)
	Helpers.VStack(Theme.Spacing.Item, SyncSection)
	Helpers.SectionLabel("Last sync", SyncSection)
	local Timestamp = Helpers.Numeral("—", SyncSection)
	Timestamp.LayoutOrder = 2
	local SyncStats = Helpers.Label("0 nodes  ·  0 images", {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.TextMuted,
		LayoutOrder = 3,
	}, SyncSection)

	Helpers.Hairline(ConnectedSections).LayoutOrder = 3

	local TargetSection = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 4,
	}, ConnectedSections)
	Helpers.VStack(Theme.Spacing.Item, TargetSection)
	Helpers.SectionLabel("Target parent", TargetSection)
	local TargetName = Helpers.Label("StarterGui", {
		FontFace = Theme.Fonts.DisplaySemi,
		TextSize = Theme.Sizes.BodyLarge,
		TextColor3 = Theme.Colors.TextPrimary,
		LayoutOrder = 2,
	}, TargetSection)

	local ResyncButton = Helpers.Button("Force resync", nil, ConnectedSections)
	ResyncButton.LayoutOrder = 5
	ResyncButton.Visible = false
	ResyncButton.MouseButton1Click:Connect(Callbacks.OnForceResync)

	SyncSection.Visible = false

	Helpers.Hairline(Inner).LayoutOrder = 7

	local Footer = Helpers.Label("v1  ·  acedian.com/figmatoroblox", {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelTiny,
		TextColor3 = Theme.Colors.TextMuted,
		LayoutOrder = 8,
	}, Inner)
	Footer.TextXAlignment = Enum.TextXAlignment.Center

	StatusView.Update("Disconnected", "Sign in to begin")
	SignInView.SetMode("SignedOut")

	local function UpdateConnectedVisibility(Mode: SignIn.Mode): ()
		ConnectedSections.Visible = Mode == "SignedIn"
	end

	local LastTimestamp = ""
	local LastStatsLine = ""
	local LastSyncEnabled: boolean? = nil

	return {
		Widget = Widget,
		SetOnboardingVisible = function(Visible: boolean)
			Onboarding.Visible = Visible
		end,
		SetStatus = StatusView.Update,
		SetSignInMode = function(Mode: SignIn.Mode, Url: string?, UserName: string?)
			SignInView.SetMode(Mode, Url, UserName)
			UpdateConnectedVisibility(Mode)
		end,
		SetSyncStats = function(NewStats: SyncStats?)
			local NewTimestamp = if NewStats then NewStats.TimestampLabel else "—"
			local NewStatsLine = if NewStats
				then string.format("%d nodes  ·  %d images", NewStats.NodeCount, NewStats.ImageCount)
				else "0 nodes  ·  0 images"
			if NewTimestamp ~= LastTimestamp then
				LastTimestamp = NewTimestamp
				Timestamp.Text = NewTimestamp
			end
			if NewStatsLine ~= LastStatsLine then
				LastStatsLine = NewStatsLine
				SyncStats.Text = NewStatsLine
			end
		end,
		SetTarget = function(Name: string)
			TargetName.Text = Name
		end,
		SetSyncEnabled = function(Enabled: boolean)
			if Enabled == LastSyncEnabled then
				return
			end
			LastSyncEnabled = Enabled
			ToggleButton.Text = if Enabled then "Disable sync" else "Enable sync to this place"
			SyncSection.Visible = Enabled
			ResyncButton.Visible = Enabled
		end,
		ShowError = StatusView.ShowError,
	}
end

return DockGui
