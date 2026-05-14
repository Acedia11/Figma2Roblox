-- SHA-256 per FIPS 180-4. Self-contained pure Luau (no script:WaitForChild).
-- Round constants K[0..63] = first 32 bits of fractional parts of cube roots
-- of the first 64 primes. https://nvlpubs.nist.gov/nistpubs/fips/nist.fips.180-4.pdf

local K = table.freeze({
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
})

local function NumberToBytes(N: number, Length: number): string
	local Out = table.create(Length)
	for I = Length, 1, -1 do
		Out[I] = string.char(bit32.band(N, 0xff))
		N = bit32.rshift(N, 8)
	end
	return table.concat(Out)
end

local function WordAt(Input: string, Offset: number): number
	return bit32.bor(
		bit32.lshift(string.byte(Input, Offset), 24),
		bit32.lshift(string.byte(Input, Offset + 1), 16),
		bit32.lshift(string.byte(Input, Offset + 2), 8),
		string.byte(Input, Offset + 3)
	)
end

local function Preprocess(Content: string): string
	local Length = #Content
	local Padding = 64 - bit32.band(Length + 9, 63)
	return Content .. "\128" .. string.rep("\0", Padding) .. NumberToBytes(8 * Length, 8)
end

local function DigestBlock(Content: string, Offset: number, State: { number }): ()
	local W = table.create(64)
	for I = 1, 16 do
		W[I] = WordAt(Content, Offset + (I - 1) * 4)
	end
	for I = 17, 64 do
		local V = W[I - 15]
		local S0 = bit32.bxor(bit32.rrotate(V, 7), bit32.rrotate(V, 18), bit32.rshift(V, 3))
		V = W[I - 2]
		local S1 = bit32.bxor(bit32.rrotate(V, 17), bit32.rrotate(V, 19), bit32.rshift(V, 10))
		W[I] = bit32.band(W[I - 16] + S0 + W[I - 7] + S1, 0xffffffff)
	end

	local A, B, C, D, E, F, G, H = State[1], State[2], State[3], State[4], State[5], State[6], State[7], State[8]
	for I = 1, 64 do
		local S1 = bit32.bxor(bit32.rrotate(E, 6), bit32.rrotate(E, 11), bit32.rrotate(E, 25))
		local Ch = bit32.bxor(bit32.band(E, F), bit32.band(bit32.bnot(E), G))
		local T1 = bit32.band(H + S1 + Ch + K[I] + W[I], 0xffffffff)
		local S0 = bit32.bxor(bit32.rrotate(A, 2), bit32.rrotate(A, 13), bit32.rrotate(A, 22))
		local Maj = bit32.bxor(bit32.band(A, B), bit32.band(A, C), bit32.band(B, C))
		local T2 = bit32.band(S0 + Maj, 0xffffffff)
		H, G, F, E, D, C, B, A =
			G, F, E, bit32.band(D + T1, 0xffffffff), C, B, A, bit32.band(T1 + T2, 0xffffffff)
	end

	State[1] = bit32.band(State[1] + A, 0xffffffff)
	State[2] = bit32.band(State[2] + B, 0xffffffff)
	State[3] = bit32.band(State[3] + C, 0xffffffff)
	State[4] = bit32.band(State[4] + D, 0xffffffff)
	State[5] = bit32.band(State[5] + E, 0xffffffff)
	State[6] = bit32.band(State[6] + F, 0xffffffff)
	State[7] = bit32.band(State[7] + G, 0xffffffff)
	State[8] = bit32.band(State[8] + H, 0xffffffff)
end

local function HashRaw(Input: string): string
	local Padded = Preprocess(Input)
	local State = { 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 }
	for I = 1, #Padded, 64 do
		DigestBlock(Padded, I, State)
	end
	local Out = table.create(8)
	for I = 1, 8 do
		Out[I] = NumberToBytes(State[I], 4)
	end
	return table.concat(Out)
end

local function HashHex(Input: string): string
	return (string.gsub(HashRaw(Input), ".", function(C: string): string
		return string.format("%02x", string.byte(C))
	end))
end

return {
	HashRaw = HashRaw,
	HashHex = HashHex,
}
