local Image = {}

local FallbackTexture = "rbxasset://textures/ui/GuiImagePlaceholder.png"

function Image.Create(Kind: string): Instance
	if Kind == "ImageLabel" then
		local Element = Instance.new("ImageLabel")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		Element.ScaleType = Enum.ScaleType.Stretch
		return Element
	elseif Kind == "ImageButton" then
		local Element = Instance.new("ImageButton")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		Element.ScaleType = Enum.ScaleType.Stretch
		Element.AutoButtonColor = false
		return Element
	end
	error("Image.Create called with unsupported Kind: " .. tostring(Kind))
end

function Image.ApplyTexture(Element: Instance, Hash: string?, AssetMap: { [string]: string }): ()
	if not Element:IsA("ImageLabel") and not Element:IsA("ImageButton") then
		return
	end
	if Hash and AssetMap[Hash] then
		(Element :: any).Image = AssetMap[Hash]
	else
		(Element :: any).Image = FallbackTexture
	end
end

return Image
