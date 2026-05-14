local HttpService = game:GetService("HttpService")

local Auth = require(script.Parent.Auth)
local Worker = require(script.Parent.Worker)

local IdleWaitSeconds = 0.25
local NotSignedInWaitSeconds = 5
local ErrorBackoffStartSeconds = 2
local ErrorBackoffMaxSeconds = 30

export type PayloadHandler = (Payload: { [string]: any }) -> ()
export type ErrorHandler = (Message: string) -> ()

local Poller = {}

local Active = false
local LastSequence = 0
local CachedUserId: string? = nil
local CachedUrlPrefix: string? = nil

local function PollUrlPrefixFor(UserId: string): string
	if UserId ~= CachedUserId then
		CachedUserId = UserId
		CachedUrlPrefix = string.format("%s/Pair/%s/Poll?since=", Worker.BaseUrl, HttpService:UrlEncode(UserId))
	end
	return CachedUrlPrefix :: string
end

local function ResolveAuthedRequest(): (string?, { [string]: string }?, string?)
	local Session = Auth.GetSession()
	if not Session.IsSignedIn or not Session.UserId then
		return nil, nil, "not signed in"
	end
	local Token = Auth.GetAccessToken()
	if not Token then
		return nil, nil, "no access token"
	end
	return PollUrlPrefixFor(Session.UserId), { ["Authorization"] = "Bearer " .. Token }, nil
end

local function AdvanceSequence(Result: any): ()
	if type(Result) ~= "table" then
		return
	end
	local Sequence = tonumber(Result.Sequence)
	if Sequence and Sequence > LastSequence then
		LastSequence = Sequence
	end
end

function Poller.Start(OnPayload: PayloadHandler, OnError: ErrorHandler?, SkipFirstPayload: boolean?): ()
	if Active then
		return
	end
	Active = true

	task.spawn(function()
		local Backoff = ErrorBackoffStartSeconds
		local Skip = SkipFirstPayload == true

		while Active do
			local UrlPrefix, Headers = ResolveAuthedRequest()
			if not UrlPrefix or not Headers then
				task.wait(NotSignedInWaitSeconds)
				continue
			end

			local Ok, Result = Worker.Get(UrlPrefix .. tostring(LastSequence), Headers)

			if not Active then
				break
			end

			if Ok then
				Backoff = ErrorBackoffStartSeconds
				if type(Result) == "table" then
					AdvanceSequence(Result)
					if not Skip then
						local DispatchOk, DispatchErr = pcall(OnPayload, Result)
						if not DispatchOk and OnError then
							pcall(OnError, "payload handler error: " .. tostring(DispatchErr))
						end
					end
				end
				Skip = false
				task.wait(IdleWaitSeconds)
			else
				if OnError then
					pcall(OnError, tostring(Result))
				end
				task.wait(Backoff)
				Backoff = math.min(Backoff * 2, ErrorBackoffMaxSeconds)
			end
		end
	end)
end

function Poller.Stop(): ()
	Active = false
end

function Poller.IsActive(): boolean
	return Active
end

function Poller.ResetSequence(): ()
	LastSequence = 0
end

function Poller.ForceFetchLatest(): (boolean, any)
	local UrlPrefix, Headers, Err = ResolveAuthedRequest()
	if not UrlPrefix or not Headers then
		return false, Err or "unauthorized"
	end
	local Ok, Result = Worker.Get(UrlPrefix .. "0", Headers)
	if Ok then
		AdvanceSequence(Result)
	end
	return Ok, Result
end

return Poller
