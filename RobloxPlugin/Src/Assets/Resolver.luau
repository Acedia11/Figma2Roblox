local InsertService = game:GetService("InsertService")

local Cache = require(script.Parent.Cache)

local Resolver = {}
local MaxConcurrentDecalLoads = 4

local function FindDecalTexture(Asset: Instance): string?
	for _, Child in ipairs(Asset:GetChildren()) do
		if Child:IsA("Decal") then
			return Child.Texture
		end
	end
	for _, Descendant in ipairs(Asset:GetDescendants()) do
		if Descendant:IsA("Decal") then
			return Descendant.Texture
		end
	end
	return nil
end

function Resolver.Resolve(Hash: string, DecalId: number): (boolean, string?)
	local Cached = Cache.Get(Hash)
	if Cached then
		return true, Cached
	end
	local Ok, Asset = pcall(InsertService.LoadAsset, InsertService, DecalId)
	if not Ok or typeof(Asset) ~= "Instance" then
		return false, "InsertService:LoadAsset(" .. tostring(DecalId) .. ") failed: " .. tostring(Asset)
	end
	local Texture = FindDecalTexture(Asset)
	Asset:Destroy()
	if not Texture then
		return false, "no Decal child found in asset " .. tostring(DecalId)
	end
	Cache.Set(Hash, Texture)
	return true, Texture
end

function Resolver.ResolveAll(Assets: { [string]: { DecalId: number?, ImageId: number? } }): { [string]: string }
	local Out: { [string]: string } = {}
	local Pending: { { Hash: string, DecalId: number } } = {}

	for Hash, Entry in pairs(Assets) do
		if type(Hash) ~= "string" or type(Entry) ~= "table" then
			continue
		end
		local Cached = Cache.Get(Hash)
		if Cached then
			Out[Hash] = Cached
		elseif type(Entry.ImageId) == "number" then
			local Texture = "rbxassetid://" .. tostring(Entry.ImageId)
			Cache.Set(Hash, Texture)
			Out[Hash] = Texture
		elseif type(Entry.DecalId) == "number" then
			table.insert(Pending, { Hash = Hash, DecalId = Entry.DecalId })
		end
	end

	if #Pending == 0 then
		Cache.Flush()
		return Out
	end

	local Done = Instance.new("BindableEvent")
	local Cursor = 0
	local Remaining = #Pending
	local WorkerCount = math.min(MaxConcurrentDecalLoads, #Pending)
	for _ = 1, WorkerCount do
		task.spawn(function()
			while true do
				Cursor += 1
				local Item = Pending[Cursor]
				if not Item then
					break
				end
				local Ok, Texture = Resolver.Resolve(Item.Hash, Item.DecalId)
				if Ok and Texture then
					Out[Item.Hash] = Texture
				end
				Remaining -= 1
				if Remaining == 0 then
					Done:Fire()
				end
			end
		end)
	end
	if Remaining > 0 then
		Done.Event:Wait()
	end
	Done:Destroy()
	Cache.Flush()

	return Out
end

return Resolver
