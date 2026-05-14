local HttpService = game:GetService("HttpService")

local Worker = {}

Worker.BaseUrl = "https://acedian.com/FigmaToRoblox/Api"

local function HandleResponse(Response: { StatusCode: number, Body: string }): (boolean, any)
	if Response.StatusCode == 204 then
		return true, nil
	end
	if Response.StatusCode < 200 or Response.StatusCode >= 300 then
		return false, "HTTP " .. Response.StatusCode .. ": " .. (Response.Body or "")
	end
	if Response.Body == "" or Response.Body == nil then
		return true, nil
	end
	local DecodeOk, Data = pcall(HttpService.JSONDecode, HttpService, Response.Body)
	if not DecodeOk then
		return false, "JSON decode failed: " .. tostring(Data)
	end
	return true, Data
end

function Worker.Get(Url: string, Headers: { [string]: string }?): (boolean, any)
	local Ok, Response = pcall(function()
		return HttpService:RequestAsync({
			Url = Url,
			Method = "GET",
			Headers = Headers or {},
		})
	end)
	if not Ok then
		return false, tostring(Response)
	end
	return HandleResponse(Response)
end

function Worker.PostForm(Url: string, Fields: { [string]: string }, Headers: { [string]: string }?): (boolean, any)
	local Parts = {}
	for Key, Value in pairs(Fields) do
		table.insert(Parts, HttpService:UrlEncode(Key) .. "=" .. HttpService:UrlEncode(Value))
	end
	local FullHeaders = { ["Content-Type"] = "application/x-www-form-urlencoded" }
	if Headers then
		for Key, Value in pairs(Headers) do
			FullHeaders[Key] = Value
		end
	end
	local Ok, Response = pcall(function()
		return HttpService:RequestAsync({
			Url = Url,
			Method = "POST",
			Headers = FullHeaders,
			Body = table.concat(Parts, "&"),
		})
	end)
	if not Ok then
		return false, tostring(Response)
	end
	return HandleResponse(Response)
end

function Worker.PostJson(Url: string, Body: any, Headers: { [string]: string }?): (boolean, any)
	local FullHeaders = { ["Content-Type"] = "application/json" }
	if Headers then
		for Key, Value in pairs(Headers) do
			FullHeaders[Key] = Value
		end
	end
	local Ok, Response = pcall(function()
		return HttpService:RequestAsync({
			Url = Url,
			Method = "POST",
			Headers = FullHeaders,
			Body = HttpService:JSONEncode(Body),
		})
	end)
	if not Ok then
		return false, tostring(Response)
	end
	return HandleResponse(Response)
end

return Worker
