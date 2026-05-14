local AspectRatio = require(script.AspectRatio)

local Responsive = {}

export type Settings = {
	AddUIAspectRatioConstraint: boolean?,
	ReferenceFrameSize: { X: number, Y: number }?,
}

function Responsive.Apply(Root: Instance, Settings: Settings?): ()
	if not Settings then
		return
	end
	if Settings.AddUIAspectRatioConstraint then
		AspectRatio.Apply(Root, Settings.ReferenceFrameSize)
	end
end

return Responsive
