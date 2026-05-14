local Cache = {}

local PluginRef: Plugin? = nil
local Memo: { [string]: string } = {}
local Dirty = false
local CacheKey = "AssetCache"

local function RequirePlugin(): Plugin
	assert(PluginRef, "Assets/Cache.Setup(plugin) was not called")
	return PluginRef
end

function Cache.Setup(P: Plugin): ()
	PluginRef = P
	local Stored = P:GetSetting(CacheKey)
	if type(Stored) == "table" then
		Memo = {}
		for Key, Value in pairs(Stored) do
			if type(Key) == "string" and type(Value) == "string" then
				Memo[Key] = Value
			end
		end
	end
end

function Cache.Get(Hash: string): string?
	return Memo[Hash]
end

function Cache.Set(Hash: string, Texture: string): ()
	if Memo[Hash] == Texture then
		return
	end
	Memo[Hash] = Texture
	Dirty = true
end

function Cache.Flush(): ()
	if not Dirty then
		return
	end
	Dirty = false
	RequirePlugin():SetSetting(CacheKey, Memo)
end

function Cache.Clear(): ()
	Memo = {}
	Dirty = false
	RequirePlugin():SetSetting(CacheKey, nil)
end

function Cache.Size(): number
	local Count = 0
	for _ in pairs(Memo) do
		Count += 1
	end
	return Count
end

return Cache
