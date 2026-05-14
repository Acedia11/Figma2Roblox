local Frame = {}

function Frame.Create(Kind: string): Instance
	if Kind == "Frame" then
		local Element = Instance.new("Frame")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		return Element
	elseif Kind == "ScrollingFrame" then
		local Element = Instance.new("ScrollingFrame")
		Element.BackgroundTransparency = 1
		Element.BorderSizePixel = 0
		Element.CanvasSize = UDim2.new(0, 0, 0, 0)
		Element.AutomaticCanvasSize = Enum.AutomaticSize.Y
		Element.ScrollBarThickness = 6
		return Element
	end
	error("Frame.Create called with unsupported Kind: " .. tostring(Kind))
end

return Frame
