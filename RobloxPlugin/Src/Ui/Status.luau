local Theme = require(script.Parent.Theme)
local Helpers = require(script.Parent.Helpers)

local Status = {}

export type State = "Disconnected" | "AwaitingSignIn" | "Connected" | "Polling" | "Paused"

export type StatusView = {
	Element: Frame,
	Update: (State: State, Detail: string?) -> (),
	ShowError: (Message: string?) -> (),
}

local StateConfig = {
	Disconnected = { Color = Theme.Colors.Disconnected, Label = "Offline" },
	AwaitingSignIn = { Color = Theme.Colors.Pending, Label = "Awaiting" },
	Connected = { Color = Theme.Colors.Connected, Label = "Connected" },
	Polling = { Color = Theme.Colors.Connected, Label = "Live" },
	Paused = { Color = Theme.Colors.Pending, Label = "Paused" },
}

function Status.Create(Parent: Instance): StatusView
	local Container = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
	}, Parent)
	Helpers.VStack(Theme.Spacing.InGroup, Container)

	Helpers.SectionLabel("Status", Container)

	local Row = Helpers.Frame({
		Size = UDim2.new(1, 0, 0, 22),
		LayoutOrder = 2,
	}, Container)
	Helpers.HStack(12, Row)

	local DotHolder = Helpers.Frame({
		Size = UDim2.new(0, 14, 0, 22),
		LayoutOrder = 1,
	}, Row)
	local Dot = Helpers.StatusDot(Theme.Colors.Disconnected, DotHolder)
	Dot.Position = UDim2.new(0.5, -4, 0.5, -4)

	local StateLabel = Helpers.Label("Offline", {
		FontFace = Theme.Fonts.Display,
		TextSize = Theme.Sizes.BodyLarge,
		TextColor3 = Theme.Colors.TextPrimary,
		Size = UDim2.new(1, -26, 1, 0),
		LayoutOrder = 2,
	}, Row)

	local Detail = Helpers.Label("Sign in to begin", {
		FontFace = Theme.Fonts.BodyRegular,
		TextSize = Theme.Sizes.LabelMedium,
		TextColor3 = Theme.Colors.TextMuted,
		LayoutOrder = 3,
	}, Container)

	local ErrorContainer = Helpers.Frame({
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		LayoutOrder = 4,
		Visible = false,
	}, Container)
	Helpers.VStack(0, ErrorContainer)
	local CurrentErrorBox: Frame? = nil
	local LastState: State? = nil
	local LastDetail: string? = nil

	local View: StatusView = {
		Element = Container,
		Update = function(NewState: State, NewDetail: string?)
			local NormalizedDetail = NewDetail or ""
			if LastState == NewState and LastDetail == NormalizedDetail then
				return
			end
			LastState = NewState
			LastDetail = NormalizedDetail
			local Config = StateConfig[NewState] or StateConfig.Disconnected
			Dot.BackgroundColor3 = Config.Color
			StateLabel.Text = Config.Label
			Detail.Text = NormalizedDetail
			Detail.Visible = NormalizedDetail ~= ""
		end,
		ShowError = function(Message: string?)
			if CurrentErrorBox then
				CurrentErrorBox:Destroy()
				CurrentErrorBox = nil
			end
			if Message and Message ~= "" then
				CurrentErrorBox = Helpers.ErrorBox(Message, ErrorContainer)
				ErrorContainer.Visible = true
			else
				ErrorContainer.Visible = false
			end
		end,
	}

	return View
end

return Status
