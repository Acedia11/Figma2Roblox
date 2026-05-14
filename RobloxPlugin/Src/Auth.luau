local HttpService = game:GetService("HttpService")

local Sha256 = require(script.Parent.Vendor.Sha256)
local Base64Url = require(script.Parent.Vendor.Base64Url)
local Worker = require(script.Parent.Worker)

local ClientId = "8400817234833495861"
local AuthorizeUrl = "https://authorize.roblox.com"
local Scopes = "openid profile asset:read asset:write"
local RedirectUri = Worker.BaseUrl .. "/Auth/Callback"

-- Token + UserInfo go through our Worker because HttpService blacklists apis.roblox.com from plugins.
local ExchangeProxyUrl = Worker.BaseUrl .. "/Auth/Exchange"
local RefreshProxyUrl = Worker.BaseUrl .. "/Auth/Refresh"
local UserInfoProxyUrl = Worker.BaseUrl .. "/Auth/UserInfo"

local Keys = {
	AccessToken = "AccessToken",
	RefreshToken = "RefreshToken",
	ExpiresAt = "ExpiresAt",
	UserId = "UserId",
	UserName = "UserName",
}

local VerifierAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
local VerifierLength = 64
local PickupPollInterval = 2
local DefaultPickupTimeout = 300
local RefreshGraceSeconds = 60

local Random = Random.new()

export type Session = {
	UserId: string?,
	UserName: string?,
	IsSignedIn: boolean,
}

export type SignInRequest = {
	Verifier: string,
	State: string,
	Url: string,
}

local Auth = {}
local PluginRef: Plugin? = nil
local ExpiredCallback: (() -> ())? = nil

local function IsRefreshExpiredError(ErrStr: any): boolean
	if type(ErrStr) ~= "string" then
		return false
	end
	if not string.find(ErrStr, "HTTP 400", 1, true) then
		return false
	end
	return string.find(ErrStr, "invalid_grant", 1, true) ~= nil
end

function Auth.OnExpired(Fn: () -> ()): ()
	ExpiredCallback = Fn
end

-- In-memory mirror of plugin settings. Every Auth.* read serves from here so the poll loop
-- doesn't pound plugin:GetSetting at 4Hz. Mutations sync through StoreTokens/StoreProfile.
local CachedAccessToken: string? = nil
local CachedRefreshToken: string? = nil
local CachedExpiresAt: number = 0
local CachedUserId: string? = nil
local CachedUserName: string? = nil

local function RequirePlugin(): Plugin
	assert(PluginRef, "Auth.Setup(plugin) was not called before using Auth")
	return PluginRef
end

local function LoadFromSettings(): ()
	local P = RequirePlugin()
	local AccessToken = P:GetSetting(Keys.AccessToken)
	local RefreshToken = P:GetSetting(Keys.RefreshToken)
	local ExpiresAt = P:GetSetting(Keys.ExpiresAt)
	local UserId = P:GetSetting(Keys.UserId)
	local UserName = P:GetSetting(Keys.UserName)
	CachedAccessToken = if type(AccessToken) == "string" then AccessToken else nil
	CachedRefreshToken = if type(RefreshToken) == "string" then RefreshToken else nil
	CachedExpiresAt = if type(ExpiresAt) == "number" then ExpiresAt else 0
	CachedUserId = if type(UserId) == "string" then UserId else nil
	CachedUserName = if type(UserName) == "string" then UserName else nil
end

function Auth.Setup(P: Plugin): ()
	PluginRef = P
	LoadFromSettings()
end

local function GenerateVerifier(): string
	local Out = table.create(VerifierLength)
	for I = 1, VerifierLength do
		local Index = Random:NextInteger(1, #VerifierAlphabet)
		Out[I] = string.sub(VerifierAlphabet, Index, Index)
	end
	return table.concat(Out)
end

local function GenerateState(): string
	return (string.gsub(HttpService:GenerateGUID(false), "-", ""))
end

local function ChallengeFor(Verifier: string): string
	return Base64Url.Encode(Sha256.HashRaw(Verifier))
end

local function StoreTokens(Data: { [string]: any }): ()
	local P = RequirePlugin()
	local AccessToken = if type(Data.access_token) == "string" then Data.access_token else nil
	local ExpiresAt = os.time() + (tonumber(Data.expires_in) or 900) - RefreshGraceSeconds
	CachedAccessToken = AccessToken
	CachedExpiresAt = ExpiresAt
	P:SetSetting(Keys.AccessToken, AccessToken)
	P:SetSetting(Keys.ExpiresAt, ExpiresAt)
	if type(Data.refresh_token) == "string" then
		CachedRefreshToken = Data.refresh_token
		P:SetSetting(Keys.RefreshToken, Data.refresh_token)
	end
end

local function StoreProfile(Profile: { [string]: any }): ()
	local P = RequirePlugin()
	local UserId = if type(Profile.sub) == "string" then Profile.sub else nil
	local UserName = if type(Profile.preferred_username) == "string" then Profile.preferred_username
		elseif type(Profile.name) == "string" then Profile.name
		else nil
	CachedUserId = UserId
	CachedUserName = UserName
	P:SetSetting(Keys.UserId, UserId)
	P:SetSetting(Keys.UserName, UserName)
end

local function ValidateProfile(Profile: any): (boolean, string?)
	if type(Profile) ~= "table" then
		return false, "userinfo returned no profile"
	end
	if type(Profile.sub) ~= "string" then
		return false, (type(Profile.Error) == "string" and Profile.Error) or "userinfo returned no sub"
	end
	return true, nil
end

function Auth.BuildAuthorizeUrl(Verifier: string, State: string): string
	local Params = {
		"client_id=" .. HttpService:UrlEncode(ClientId),
		"code_challenge=" .. HttpService:UrlEncode(ChallengeFor(Verifier)),
		"code_challenge_method=S256",
		"redirect_uri=" .. HttpService:UrlEncode(RedirectUri),
		"scope=" .. HttpService:UrlEncode(Scopes),
		"response_type=Code",
		"state=" .. HttpService:UrlEncode(State),
		"prompts=" .. HttpService:UrlEncode("login consent"),
	}
	return AuthorizeUrl .. "?" .. table.concat(Params, "&")
end

function Auth.BeginSignIn(): SignInRequest
	local Verifier = GenerateVerifier()
	local State = GenerateState()
	return {
		Verifier = Verifier,
		State = State,
		Url = Auth.BuildAuthorizeUrl(Verifier, State),
	}
end

local PickupCancelled = false

function Auth.CancelPickup(): ()
	PickupCancelled = true
end

function Auth.WaitForCode(State: string, TimeoutSeconds: number?): (boolean, string?)
	PickupCancelled = false
	local Deadline = os.time() + (TimeoutSeconds or DefaultPickupTimeout)
	local Url = Worker.BaseUrl .. "/Auth/PickupCode?state=" .. HttpService:UrlEncode(State)
	while os.time() < Deadline do
		if PickupCancelled then
			return false, "cancelled"
		end
		local Ok, Data = Worker.Get(Url)
		if Ok and type(Data) == "table" and Data.Code then
			return true, Data.Code
		end
		task.wait(PickupPollInterval)
	end
	return false, "timed out waiting for OAuth code (" .. tostring(TimeoutSeconds or DefaultPickupTimeout) .. "s)"
end

function Auth.FetchUserInfo(Token: string?): (boolean, any)
	local Bearer = Token or Auth.GetAccessToken()
	if not Bearer then
		return false, "no access token"
	end
	return Worker.Get(UserInfoProxyUrl, { ["Authorization"] = "Bearer " .. Bearer })
end

function Auth.Refresh(): (boolean, any)
	if not CachedRefreshToken then
		return false, "no refresh token stored"
	end
	local Ok, Data = Worker.PostJson(RefreshProxyUrl, { RefreshToken = CachedRefreshToken })
	if not Ok then
		if IsRefreshExpiredError(Data) then
			Auth.SignOut()
			if ExpiredCallback then
				pcall(ExpiredCallback)
			end
		end
		return false, Data
	end
	if type(Data) ~= "table" or type(Data.access_token) ~= "string" then
		return false, (type(Data) == "table" and Data.Error) or "refresh returned no access_token"
	end
	StoreTokens(Data)
	return true, Data
end

function Auth.ExchangeCode(Code: string, Verifier: string): (boolean, any)
	local Ok, Data = Worker.PostJson(ExchangeProxyUrl, {
		Code = Code,
		Verifier = Verifier,
	})
	if not Ok then
		return false, Data
	end
	if type(Data) ~= "table" or type(Data.access_token) ~= "string" then
		return false, (type(Data) == "table" and Data.Error) or "token exchange returned no access_token"
	end
	local InfoOk, Info = Auth.FetchUserInfo(Data.access_token)
	if not InfoOk then
		return false, Info
	end
	local ProfileOk, ProfileErr = ValidateProfile(Info)
	if not ProfileOk then
		return false, ProfileErr
	end
	StoreTokens(Data)
	StoreProfile(Info)
	return true, Data
end

function Auth.GetAccessToken(): string?
	if CachedAccessToken and os.time() < CachedExpiresAt then
		return CachedAccessToken
	end
	if not CachedRefreshToken then
		return nil
	end
	local Ok, Data = Auth.Refresh()
	if not Ok then
		return nil
	end
	return if type(Data) == "table" and type(Data.access_token) == "string" then Data.access_token else CachedAccessToken
end

function Auth.GetSession(): Session
	return {
		UserId = CachedUserId,
		UserName = CachedUserName,
		IsSignedIn = CachedRefreshToken ~= nil and CachedUserId ~= nil,
	}
end

function Auth.SignOut(): ()
	local P = RequirePlugin()
	for _, Key in pairs(Keys) do
		P:SetSetting(Key, nil)
	end
	CachedAccessToken = nil
	CachedRefreshToken = nil
	CachedExpiresAt = 0
	CachedUserId = nil
	CachedUserName = nil
end

return Auth
