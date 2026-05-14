local StarterGui = game:GetService("StarterGui")

local Auth = require(script.Auth)
local Poller = require(script.Poller)
local Builder = require(script.Builder)
local AssetCache = require(script.Assets.Cache)
local DockGui = require(script.Ui.DockGui)

Auth.Setup(plugin)
AssetCache.Setup(plugin)

Auth.OnExpired(function()
	Poller.Stop()
	if Dock then
		Dock.SetSyncEnabled(false)
		Dock.SetSyncStats(nil)
		Dock.ShowError("Your sign-in expired. Please sign in again.")
		Dock.SetSignInMode("SignedOut")
		Dock.SetStatus("Disconnected", "Sign-in expired")
	end
end)

local Toolbar = plugin:CreateToolbar("FigmaToRoblox")
local ToolbarButton = Toolbar:CreateButton(
	"FigmaToRoblox",
	"Open the FigmaToRoblox dock",
	"rbxasset://textures/Icon_Stream_Off@2x.png"
)

local TargetParent: Instance = StarterGui

local ListeningStatus = "Listening for Figma updates"
local PausedStatus = "Sync paused for this place"
local PausedHint = "Click Enable to sync this place"

local Dock: DockGui.DockView
local SignInThread: thread? = nil
local PollErrorCount = 0
local PollErrorThreshold = 3
local OnboardingKey = "FigmaToRobloxHasOnboarded"
local LegacyOnboardingKey = "FigmaToRoblox.HasOnboarded"
local HasOnboarded = false

local function StoreOnboardingState(): ()
	pcall(function()
		plugin:SetSetting(OnboardingKey, true)
	end)
end

local function ReadOnboardingState(): boolean
	local Ok, Value = pcall(function()
		return plugin:GetSetting(OnboardingKey)
	end)
	if Ok and Value == true then
		return true
	end

	local LegacyOk, LegacyValue = pcall(function()
		return plugin:GetSetting(LegacyOnboardingKey)
	end)
	if LegacyOk and LegacyValue == true then
		StoreOnboardingState()
		return true
	end
	return false
end

local function MarkOnboarded(): ()
	if HasOnboarded then
		return
	end
	HasOnboarded = true
	StoreOnboardingState()
end

local function HideOnboarding(): ()
	MarkOnboarded()
	if Dock then
		Dock.SetOnboardingVisible(false)
	end
end

local function ApplyPayload(Payload: { [string]: any }): ()
	local Ok, Result = Builder.Build(Payload, TargetParent)
	if Ok and type(Result) == "table" then
		local Stats = Result :: Builder.BuildStats
		Dock.SetSyncStats({
			TimestampLabel = os.date("%H:%M:%S") :: string,
			NodeCount = Stats.NodeCount,
			ImageCount = Stats.ImageCount,
		})
		Dock.ShowError(nil)
	else
		warn("[FigmaToRoblox] Builder failed:", Result)
		Dock.SetStatus("Polling", "Build error: " .. tostring(Result))
		Dock.ShowError("Build failed: " .. tostring(Result))
	end
end

local function StartPolling()
	if Poller.IsActive() then
		return
	end
	Dock.SetStatus("Polling", ListeningStatus)
	PollErrorCount = 0
	Poller.Start(function(Payload)
		PollErrorCount = 0
		Dock.ShowError(nil)
		Dock.SetStatus("Polling", "Sync received · sequence " .. tostring(Payload.Sequence or "?"))
		ApplyPayload(Payload)
	end, function(Message)
		PollErrorCount += 1
		warn("[FigmaToRoblox] Poller error:", Message)
		if PollErrorCount >= PollErrorThreshold then
			Dock.ShowError("Sync polling failed (" .. tostring(PollErrorCount) .. "x): " .. tostring(Message))
		end
	end, true)
end

local function FetchAndApplyLatest(EmptyMessage: string): ()
	Dock.SetStatus("Polling", "Resyncing latest payload")
	task.spawn(function()
		local Ok, Result = Poller.ForceFetchLatest()
		if not Ok then
			warn("[FigmaToRoblox] Resync failed:", Result)
			Dock.SetStatus("Polling", "Resync failed: " .. tostring(Result))
			Dock.ShowError("Resync failed: " .. tostring(Result))
			return
		end
		if type(Result) ~= "table" or not Result.Tree then
			Dock.SetStatus("Polling", EmptyMessage)
			return
		end
		Dock.SetStatus("Polling", "Resync applied · sequence " .. tostring(Result.Sequence or "?"))
		ApplyPayload(Result)
	end)
end

local function ApplySignedInState()
	local Session = Auth.GetSession()
	if Session.IsSignedIn then
		HideOnboarding()
		print("[FigmaToRoblox] Signed in as", Session.UserName, "| UserId:", Session.UserId)
		Dock.SetSignInMode("SignedIn", nil, Session.UserName or ("user " .. tostring(Session.UserId)))
		local Active = Poller.IsActive()
		Dock.SetSyncEnabled(Active)
		Dock.SetStatus(if Active then "Polling" else "Paused", if Active then ListeningStatus else PausedHint)
		Dock.ShowError(nil)
	else
		Dock.SetSignInMode("SignedOut")
		Dock.SetStatus("Disconnected", "Sign in to begin")
	end
end

local function HandleSignInClick()
	if SignInThread then
		return
	end
	Dock.ShowError(nil)
	local Request = Auth.BeginSignIn()
	Dock.SetSignInMode("AwaitingPaste", Request.Url)
	Dock.SetStatus("AwaitingSignIn", "Paste URL in browser")
	SignInThread = task.spawn(function()
		local Ok, CodeOrError = Auth.WaitForCode(Request.State)
		if not Ok then
			SignInThread = nil
			if CodeOrError ~= "cancelled" then
				warn("[FigmaToRoblox] Sign-in pickup failed:", CodeOrError)
				Dock.SetStatus("Disconnected", "Sign-in failed")
				Dock.ShowError(tostring(CodeOrError))
				Dock.SetSignInMode("SignedOut")
			end
			return
		end
		local ExchangeOk, ExchangeResult = Auth.ExchangeCode(CodeOrError :: string, Request.Verifier)
		SignInThread = nil
		if not ExchangeOk then
			warn("[FigmaToRoblox] Token exchange failed:", ExchangeResult)
			Dock.SetStatus("Disconnected", "Token exchange failed")
			Dock.ShowError(tostring(ExchangeResult))
			Dock.SetSignInMode("SignedOut")
			return
		end
		ApplySignedInState()
	end)
end

local function HandleCancelSignIn()
	Auth.CancelPickup()
	SignInThread = nil
	Dock.ShowError(nil)
	Dock.SetSignInMode("SignedOut")
	Dock.SetStatus("Disconnected", "Sign-in cancelled")
end

local function HandleSignOutClick()
	Poller.Stop()
	Dock.SetSyncEnabled(false)
	Auth.SignOut()
	Dock.SetSyncStats(nil)
	Dock.ShowError(nil)
	Dock.SetSignInMode("SignedOut")
	Dock.SetStatus("Disconnected", "Signed out")
end

local function HandleToggleSync()
	if not Auth.GetSession().IsSignedIn then
		return
	end
	if Poller.IsActive() then
		Poller.Stop()
		Dock.SetSyncEnabled(false)
		Dock.SetStatus("Paused", PausedStatus)
	else
		StartPolling()
		Dock.SetSyncEnabled(true)
	end
end

local function HandleForceResync()
	if not Auth.GetSession().IsSignedIn or not Poller.IsActive() then
		return
	end
	FetchAndApplyLatest("No payload to resync — push from Figma first")
end

Dock = DockGui.Create(plugin, {
	OnSignIn = HandleSignInClick,
	OnSignOut = HandleSignOutClick,
	OnCancelSignIn = HandleCancelSignIn,
	OnForceResync = HandleForceResync,
	OnToggleSync = HandleToggleSync,
	OnDismissOnboarding = HideOnboarding,
})

Dock.SetTarget(TargetParent.Name)

HasOnboarded = ReadOnboardingState()
ApplySignedInState()
if not Auth.GetSession().IsSignedIn and not HasOnboarded then
	Dock.SetOnboardingVisible(true)
end

ToolbarButton.Click:Connect(function()
	Dock.Widget.Enabled = not Dock.Widget.Enabled
	ToolbarButton:SetActive(Dock.Widget.Enabled)
end)

Dock.Widget:GetPropertyChangedSignal("Enabled"):Connect(function()
	ToolbarButton:SetActive(Dock.Widget.Enabled)
end)

plugin.Unloading:Connect(function()
	Poller.Stop()
	Auth.CancelPickup()
	SignInThread = nil
	Dock.Widget:Destroy()
end)
