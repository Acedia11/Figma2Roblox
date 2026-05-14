local Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

local function CharAt(Index: number): string
	return string.sub(Alphabet, Index + 1, Index + 1)
end

local function Encode(Input: string): string
	local Out = {}
	local Length = #Input
	for I = 1, Length, 3 do
		local B1 = string.byte(Input, I)
		local B2 = string.byte(Input, I + 1) or 0
		local B3 = string.byte(Input, I + 2) or 0
		local N = bit32.bor(bit32.lshift(B1, 16), bit32.lshift(B2, 8), B3)
		table.insert(Out, CharAt(bit32.rshift(N, 18)))
		table.insert(Out, CharAt(bit32.band(bit32.rshift(N, 12), 63)))
		if I + 1 <= Length then
			table.insert(Out, CharAt(bit32.band(bit32.rshift(N, 6), 63)))
		end
		if I + 2 <= Length then
			table.insert(Out, CharAt(bit32.band(N, 63)))
		end
	end
	return table.concat(Out)
end

return {
	Encode = Encode,
}
