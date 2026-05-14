local CollectionService = game:GetService("CollectionService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local Selection = game:GetService("Selection")

local Frame = require(script.Frame)
local Image = require(script.Image)
local Text = require(script.Text)
local Layout = require(script.Layout)
local Resolver = require(script.Parent.Assets.Resolver)
local Responsive = require(script.Parent.Responsive)

local RootTag = "FigmaToRobloxRoot"
local ScreenGuiName = "FigmaToRoblox"
local RootName = "Root"

local Builder = {}

export type UDimLike = { Scale: number, Offset: number }
export type UDim2Like = { X: UDimLike, Y: UDimLike }
export type ColorLike = { R: number, G: number, B: number, A: number? }

export type UiNode = {
	FigmaId: string,
	Name: string?,
	Kind: string,
	Position: UDim2Like?,
	Size: UDim2Like?,
	AnchorPoint: { X: number, Y: number }?,
	Rotation: number?,
	ZIndex: number?,
	LayoutOrder: number?,
	Visible: boolean?,
	ClipsDescendants: boolean?,
	BackgroundColor: ColorLike?,
	ImageHash: string?,
	Text: Text.TextProps?,
	Layout: Layout.LayoutProps?,
	Padding: Layout.PaddingProps?,
	Children: { UiNode }?,
}

export type Settings = {
	AddUIAspectRatioConstraint: boolean?,
	AutoDetectButtons: boolean?,
	ReferenceFrameSize: { X: number, Y: number }?,
}

export type Payload = {
	Sequence: number,
	Tree: UiNode,
	Assets: { [string]: { DecalId: number?, ImageId: number? } }?,
	Settings: Settings?,
}

export type BuildStats = {
	Root: Instance,
	NodeCount: number,
	ImageCount: number,
}

local function ToUDim2(V: UDim2Like?): UDim2
	if not V then
		return UDim2.new(0, 0, 0, 0)
	end
	return UDim2.new(V.X.Scale or 0, V.X.Offset or 0, V.Y.Scale or 0, V.Y.Offset or 0)
end

local function ToColor3(C: ColorLike?): Color3?
	if not C then
		return nil
	end
	return Color3.new(C.R, C.G, C.B)
end

local function CreateForKind(Kind: string): Instance
	if Kind == "Frame" or Kind == "ScrollingFrame" then
		return Frame.Create(Kind)
	elseif Kind == "ImageLabel" or Kind == "ImageButton" then
		return Image.Create(Kind)
	elseif Kind == "TextLabel" or Kind == "TextButton" or Kind == "TextBox" then
		return Text.Create(Kind)
	end
	error("Unknown UiNodeKind: " .. tostring(Kind))
end

local function ApplyCommonProps(Element: Instance, Node: UiNode): ()
	Element.Name = Node.Name or Node.FigmaId
	local AsGui = Element :: GuiObject
	AsGui.Position = ToUDim2(Node.Position)
	AsGui.Size = ToUDim2(Node.Size)
	if Node.AnchorPoint then
		AsGui.AnchorPoint = Vector2.new(Node.AnchorPoint.X or 0, Node.AnchorPoint.Y or 0)
	end
	AsGui.Rotation = Node.Rotation or 0
	AsGui.ZIndex = Node.ZIndex or 1
	AsGui.LayoutOrder = Node.LayoutOrder or 0
	AsGui.Visible = Node.Visible ~= false
	AsGui.ClipsDescendants = Node.ClipsDescendants == true
	if Node.BackgroundColor then
		AsGui.BackgroundTransparency = 1 - (Node.BackgroundColor.A or 1)
		local C = ToColor3(Node.BackgroundColor)
		if C then
			AsGui.BackgroundColor3 = C
		end
	end
	Element:SetAttribute("FigmaNodeId", Node.FigmaId)
end

local function BuildNode(Node: UiNode, AssetMap: { [string]: string }, Counts: { Nodes: number, Images: number }, Parent: Instance?): Instance
	local Element = CreateForKind(Node.Kind)
	ApplyCommonProps(Element, Node)
	Counts.Nodes += 1

	if Element:IsA("ImageLabel") or Element:IsA("ImageButton") then
		Image.ApplyTexture(Element, Node.ImageHash, AssetMap)
		Counts.Images += 1
	end

	if Node.Text and (Element:IsA("TextLabel") or Element:IsA("TextButton") or Element:IsA("TextBox")) then
		Text.Apply(Element, Node.Text)
	end

	if Node.Layout then
		Layout.Apply(Element, Node.Layout)
	end
	if Node.Padding then
		Layout.ApplyPadding(Element, Node.Padding)
	end

	if Node.Children then
		for _, ChildNode in ipairs(Node.Children) do
			BuildNode(ChildNode, AssetMap, Counts, Element)
		end
	end

	if Parent then
		Element.Parent = Parent
	end
	return Element
end

local function FindExistingRoots(Target: Instance): { Instance }
	local Found: { Instance } = {}
	for _, Tagged in ipairs(CollectionService:GetTagged(RootTag)) do
		if Tagged:IsDescendantOf(Target) then
			table.insert(Found, Tagged)
		end
	end
	return Found
end

local function CreateContainer(FigmaId: string): ScreenGui
	local Container = Instance.new("ScreenGui")
	Container.Name = ScreenGuiName
	Container.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	Container.IgnoreGuiInset = true
	Container.ResetOnSpawn = false
	Container:SetAttribute("FigmaNodeId", FigmaId)
	return Container
end

local function RestoreRoots(Roots: { Instance }, Target: Instance): ()
	for _, Existing in ipairs(Roots) do
		if Existing.Parent == nil then
			Existing.Parent = Target
		end
	end
end

function Builder.Build(Payload: Payload, Target: Instance): (boolean, BuildStats | string)
	if not Payload or not Payload.Tree then
		return false, "payload missing Tree"
	end

	local AssetMap: { [string]: string } = {}
	if Payload.Assets then
		AssetMap = Resolver.ResolveAll(Payload.Assets)
	end

	local Container = CreateContainer(Payload.Tree.FigmaId)
	local Counts = { Nodes = 0, Images = 0 }
	local BuildOk, BuildResult = pcall(function()
		local Root = BuildNode(Payload.Tree, AssetMap, Counts, Container)
		Root.Name = RootName
		Responsive.Apply(Root, Payload.Settings)
		CollectionService:AddTag(Container, RootTag)
	end)
	if not BuildOk then
		Container:Destroy()
		return false, tostring(BuildResult)
	end

	local Recording = ChangeHistoryService:TryBeginRecording("FigmaSync", "Sync Figma → Roblox")
	if not Recording then
		Container:Destroy()
		return false, "could not begin ChangeHistory recording (already in progress or playtest)"
	end

	local ExistingRoots = FindExistingRoots(Target)
	local ReplaceOk, ReplaceErr = pcall(function()
		for _, Existing in ipairs(ExistingRoots) do
			Existing.Parent = nil
		end
		Container.Parent = Target
		ChangeHistoryService:FinishRecording(Recording, Enum.FinishRecordingOperation.Commit)
	end)
	if not ReplaceOk then
		if Container.Parent then
			Container.Parent = nil
		end
		RestoreRoots(ExistingRoots, Target)
		Container:Destroy()
		pcall(function()
			ChangeHistoryService:FinishRecording(Recording, Enum.FinishRecordingOperation.Cancel)
		end)
		return false, tostring(ReplaceErr)
	end

	Selection:Set({ Container })
	return true, { Root = Container, NodeCount = Counts.Nodes, ImageCount = Counts.Images }
end

return Builder
