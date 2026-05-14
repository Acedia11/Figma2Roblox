local AspectRatio = {}

function AspectRatio.Apply(Root: Instance, Reference: { X: number, Y: number }?): ()
	local RefX = (Reference and Reference.X) or 1920
	local RefY = (Reference and Reference.Y) or 1080
	if RefY == 0 then
		return
	end

	local Constraint = Instance.new("UIAspectRatioConstraint")
	Constraint.Name = "FigmaToRobloxAspect"
	Constraint.AspectRatio = RefX / RefY
	Constraint.AspectType = Enum.AspectType.FitWithinMaxSize
	Constraint.DominantAxis = Enum.DominantAxis.Width
	Constraint.Parent = Root
end

return AspectRatio
