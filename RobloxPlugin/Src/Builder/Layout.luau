local Layout = {}

export type UDimLike = { Scale: number, Offset: number }

export type LayoutProps = {
	Type: string?,
	FillDirection: string?,
	HorizontalAlignment: string?,
	VerticalAlignment: string?,
	Padding: (number | UDimLike)?,
	SortOrder: string?,
	CellSize: { X: UDimLike, Y: UDimLike }?,
	CellPadding: { X: UDimLike, Y: UDimLike }?,
	StartCorner: string?,
	Flex: string?,
}

export type PaddingProps = {
	Top: UDimLike?,
	Bottom: UDimLike?,
	Left: UDimLike?,
	Right: UDimLike?,
}

local function FillDirectionFromName(Name: string?): Enum.FillDirection
	if Name == "Horizontal" then
		return Enum.FillDirection.Horizontal
	end
	return Enum.FillDirection.Vertical
end

local function HorizontalAlignmentFromName(Name: string?): Enum.HorizontalAlignment
	if Name == "Center" then return Enum.HorizontalAlignment.Center end
	if Name == "Right" then return Enum.HorizontalAlignment.Right end
	return Enum.HorizontalAlignment.Left
end

local function VerticalAlignmentFromName(Name: string?): Enum.VerticalAlignment
	if Name == "Center" then return Enum.VerticalAlignment.Center end
	if Name == "Bottom" then return Enum.VerticalAlignment.Bottom end
	return Enum.VerticalAlignment.Top
end

local function SortOrderFromName(Name: string?): Enum.SortOrder
	if Name == "Name" then
		return Enum.SortOrder.Name
	end
	return Enum.SortOrder.LayoutOrder
end

local function StartCornerFromName(Name: string?): Enum.StartCorner
	if Name == "TopRight" then return Enum.StartCorner.TopRight end
	if Name == "BottomLeft" then return Enum.StartCorner.BottomLeft end
	if Name == "BottomRight" then return Enum.StartCorner.BottomRight end
	return Enum.StartCorner.TopLeft
end

local function FlexFromName(Name: string?): Enum.UIFlexAlignment
	if Name == "Fill" then return Enum.UIFlexAlignment.Fill end
	if Name == "SpaceAround" then return Enum.UIFlexAlignment.SpaceAround end
	if Name == "SpaceBetween" then return Enum.UIFlexAlignment.SpaceBetween end
	if Name == "SpaceEvenly" then return Enum.UIFlexAlignment.SpaceEvenly end
	return Enum.UIFlexAlignment.None
end

local function PaddingToUDim(P: (number | UDimLike)?): UDim
	if P == nil then return UDim.new(0, 0) end
	if typeof(P) == "number" then return UDim.new(0, P) end
	return UDim.new(P.Scale or 0, P.Offset or 0)
end

local function ToUDim(D: UDimLike?): UDim
	if not D then
		return UDim.new(0, 0)
	end
	return UDim.new(D.Scale or 0, D.Offset or 0)
end

local function ToUDim2(V: { X: UDimLike, Y: UDimLike }): UDim2
	local X, Y = ToUDim(V.X), ToUDim(V.Y)
	return UDim2.new(X.Scale, X.Offset, Y.Scale, Y.Offset)
end

function Layout.Apply(Parent: Instance, Props: LayoutProps?): ()
	if not Props then
		return
	end
	if Props.Type == "Grid" then
		local Grid = Instance.new("UIGridLayout")
		Grid.HorizontalAlignment = HorizontalAlignmentFromName(Props.HorizontalAlignment)
		Grid.VerticalAlignment = VerticalAlignmentFromName(Props.VerticalAlignment)
		Grid.SortOrder = SortOrderFromName(Props.SortOrder)
		Grid.StartCorner = StartCornerFromName(Props.StartCorner)
		if Props.CellSize then
			Grid.CellSize = ToUDim2(Props.CellSize)
		end
		if Props.CellPadding then
			Grid.CellPadding = ToUDim2(Props.CellPadding)
		end
		Grid.Parent = Parent
	else
		local List = Instance.new("UIListLayout")
		List.FillDirection = FillDirectionFromName(Props.FillDirection)
		List.HorizontalAlignment = HorizontalAlignmentFromName(Props.HorizontalAlignment)
		List.VerticalAlignment = VerticalAlignmentFromName(Props.VerticalAlignment)
		List.SortOrder = SortOrderFromName(Props.SortOrder)
		if Props.Padding ~= nil then
			List.Padding = PaddingToUDim(Props.Padding)
		end
		if Props.Flex then
			local Alignment = FlexFromName(Props.Flex)
			if List.FillDirection == Enum.FillDirection.Horizontal then
				List.HorizontalFlex = Alignment
			else
				List.VerticalFlex = Alignment
			end
		end
		List.Parent = Parent
	end
end

function Layout.ApplyPadding(Parent: Instance, Props: PaddingProps?): ()
	if not Props then
		return
	end
	local Padding = Instance.new("UIPadding")
	Padding.PaddingTop = ToUDim(Props.Top)
	Padding.PaddingBottom = ToUDim(Props.Bottom)
	Padding.PaddingLeft = ToUDim(Props.Left)
	Padding.PaddingRight = ToUDim(Props.Right)
	Padding.Parent = Parent
end

return Layout
