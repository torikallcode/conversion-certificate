package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
)

// Encoder QR Code minimal (mode byte, koreksi galat level M, versi 1-10)
// ditulis sendiri agar API tetap mandiri tanpa dependensi eksternal.

type qrSpec struct {
	dataCodewords int
	ecPerBlock    int
	blocks        []int
}

var qrSpecs = []qrSpec{
	{}, // versi 0 tidak dipakai
	{16, 10, []int{16}},
	{28, 16, []int{28}},
	{44, 26, []int{44}},
	{64, 18, []int{32, 32}},
	{86, 24, []int{43, 43}},
	{108, 16, []int{27, 27, 27, 27}},
	{124, 18, []int{31, 31, 31, 31}},
	{154, 22, []int{38, 38, 39, 39}},
	{182, 22, []int{36, 36, 36, 37, 37}},
	{216, 26, []int{43, 43, 43, 43, 44}},
}

var alignmentPositions = [][]int{
	{}, // 1
	{}, // 1
	{6, 18},
	{6, 22},
	{6, 26},
	{6, 30},
	{6, 34},
	{6, 22, 38},
	{6, 24, 42},
	{6, 26, 46},
	{6, 28, 50},
}

func qrEncodePNG(content string, moduleSize int) ([]byte, error) {
	matrix, err := qrMatrix([]byte(content))
	if err != nil {
		return nil, err
	}
	quiet := 4
	size := len(matrix)
	total := (size + quiet*2) * moduleSize
	img := image.NewRGBA(image.Rect(0, 0, total, total))
	white := color.RGBA{255, 255, 255, 255}
	black := color.RGBA{17, 24, 39, 255}
	for y := 0; y < total; y++ {
		for x := 0; x < total; x++ {
			img.Set(x, y, white)
		}
	}
	for row := 0; row < size; row++ {
		for col := 0; col < size; col++ {
			if !matrix[row][col] {
				continue
			}
			startX := (col + quiet) * moduleSize
			startY := (row + quiet) * moduleSize
			for dy := 0; dy < moduleSize; dy++ {
				for dx := 0; dx < moduleSize; dx++ {
					img.Set(startX+dx, startY+dy, black)
				}
			}
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func qrMatrix(data []byte) ([][]bool, error) {
	return qrBuild(data, -1)
}

func qrBuild(data []byte, fixedMask int) ([][]bool, error) {
	version := 0
	spec := qrSpec{}
	for v := 1; v <= 10; v++ {
		countBits := 8
		if v >= 10 {
			countBits = 16
		}
		capacityBits := qrSpecs[v].dataCodewords*8 - 4 - countBits
		if len(data)*8 <= capacityBits {
			version = v
			spec = qrSpecs[v]
			break
		}
	}
	if version == 0 {
		return nil, fmt.Errorf("data QR terlalu panjang (%d byte)", len(data))
	}

	bits := qrDataBits(data, version, spec.dataCodewords)
	codewords := qrInterleave(bits, spec)

	size := 17 + 4*version
	modules := make([][]bool, size)
	reserved := make([][]bool, size)
	for i := range modules {
		modules[i] = make([]bool, size)
		reserved[i] = make([]bool, size)
	}

	drawFunctionPatterns(modules, reserved, version)
	placeData(modules, reserved, codewords)

	if fixedMask >= 0 && fixedMask < 8 {
		applyMask(modules, reserved, fixedMask)
		drawFormatBits(modules, fixedMask)
		drawVersionBits(modules, version)
		return modules, nil
	}

	bestMask := 0
	bestPenalty := math.MaxInt32
	var bestModules [][]bool
	for mask := 0; mask < 8; mask++ {
		candidate := cloneMatrix(modules)
		applyMask(candidate, reserved, mask)
		drawFormatBits(candidate, mask)
		drawVersionBits(candidate, version)
		p := penalty(candidate)
		if p < bestPenalty {
			bestPenalty = p
			bestMask = mask
			bestModules = candidate
		}
	}
	_ = bestMask
	return bestModules, nil
}

func cloneMatrix(src [][]bool) [][]bool {
	dst := make([][]bool, len(src))
	for i := range src {
		dst[i] = append([]bool(nil), src[i]...)
	}
	return dst
}

func qrDataBits(data []byte, version, dataCodewords int) []bool {
	bits := make([]bool, 0, dataCodewords*8)
	appendBits := func(val, n int) {
		for i := n - 1; i >= 0; i-- {
			bits = append(bits, (val>>i)&1 == 1)
		}
	}
	appendBits(0b0100, 4)
	if version >= 10 {
		appendBits(len(data), 16)
	} else {
		appendBits(len(data), 8)
	}
	for _, b := range data {
		appendBits(int(b), 8)
	}
	capacity := dataCodewords * 8
	terminator := 4
	if capacity-len(bits) < terminator {
		terminator = capacity - len(bits)
	}
	for i := 0; i < terminator; i++ {
		bits = append(bits, false)
	}
	for len(bits)%8 != 0 {
		bits = append(bits, false)
	}
	pad := []byte{0xEC, 0x11}
	for i := 0; len(bits) < capacity; i++ {
		appendBits(int(pad[i%2]), 8)
	}
	return bits
}

func qrInterleave(bits []bool, spec qrSpec) []byte {
	dataBytes := make([]byte, len(bits)/8)
	for i := range dataBytes {
		var v byte
		for j := 0; j < 8; j++ {
			if bits[i*8+j] {
				v |= 1 << (7 - j)
			}
		}
		dataBytes[i] = v
	}

	blocks := make([][]byte, len(spec.blocks))
	ecBlocks := make([][]byte, len(spec.blocks))
	offset := 0
	for i, n := range spec.blocks {
		blocks[i] = dataBytes[offset : offset+n]
		offset += n
		ecBlocks[i] = rsEncode(blocks[i], spec.ecPerBlock)
	}

	out := make([]byte, 0, len(dataBytes)+spec.ecPerBlock*len(spec.blocks))
	maxData := 0
	for _, b := range blocks {
		if len(b) > maxData {
			maxData = len(b)
		}
	}
	for i := 0; i < maxData; i++ {
		for _, b := range blocks {
			if i < len(b) {
				out = append(out, b[i])
			}
		}
	}
	for i := 0; i < spec.ecPerBlock; i++ {
		for _, b := range ecBlocks {
			out = append(out, b[i])
		}
	}
	return out
}

var gfExp [512]byte
var gfLog [256]int

func init() {
	x := 1
	for i := 0; i < 255; i++ {
		gfExp[i] = byte(x)
		gfLog[x] = i
		x <<= 1
		if x&0x100 != 0 {
			x ^= 0x11D
		}
	}
	for i := 255; i < 512; i++ {
		gfExp[i] = gfExp[i-255]
	}
}

func gfMul(a, b byte) byte {
	if a == 0 || b == 0 {
		return 0
	}
	return gfExp[gfLog[a]+gfLog[b]]
}

func rsGenerator(degree int) []byte {
	gen := []byte{1}
	for i := 0; i < degree; i++ {
		next := make([]byte, len(gen)+1)
		for j := range gen {
			next[j] ^= gen[j]
			next[j+1] ^= gfMul(gen[j], gfExp[i])
		}
		gen = next
	}
	return gen
}

func rsEncode(data []byte, ecLen int) []byte {
	gen := rsGenerator(ecLen)
	rem := make([]byte, ecLen)
	for _, b := range data {
		factor := b ^ rem[0]
		copy(rem, rem[1:])
		rem[ecLen-1] = 0
		for i := 0; i < ecLen; i++ {
			rem[i] ^= gfMul(gen[i+1], factor)
		}
	}
	return rem
}

func drawFunctionPatterns(m, reserved [][]bool, version int) {
	size := len(m)

	setFinder := func(row, col int) {
		for r := -1; r <= 7; r++ {
			for c := -1; c <= 7; c++ {
				rr, cc := row+r, col+c
				if rr < 0 || rr >= size || cc < 0 || cc >= size {
					continue
				}
				dark := (r >= 0 && r <= 6 && (c == 0 || c == 6)) ||
					(c >= 0 && c <= 6 && (r == 0 || r == 6)) ||
					(r >= 2 && r <= 4 && c >= 2 && c <= 4)
				m[rr][cc] = dark
				reserved[rr][cc] = true
			}
		}
	}
	setFinder(0, 0)
	setFinder(0, size-7)
	setFinder(size-7, 0)

	for i := 8; i < size-8; i++ {
		m[6][i] = i%2 == 0
		m[i][6] = i%2 == 0
		reserved[6][i] = true
		reserved[i][6] = true
	}

	positions := alignmentPositions[version]
	for _, row := range positions {
		for _, col := range positions {
			if (row == 6 && col == 6) || (row == 6 && col == size-7) || (row == size-7 && col == 6) {
				continue
			}
			for r := -2; r <= 2; r++ {
				for c := -2; c <= 2; c++ {
					dark := max(abs(r), abs(c)) != 1
					m[row+r][col+c] = dark
					reserved[row+r][col+c] = true
				}
			}
		}
	}

	reserved[size-8][8] = true
	m[size-8][8] = true

	for i := 0; i <= 8; i++ {
		if i != 6 {
			reserved[8][i] = true
			reserved[i][8] = true
		}
	}
	for i := size - 8; i < size; i++ {
		reserved[8][i] = true
		reserved[i][8] = true
	}

	if version >= 7 {
		for i := 0; i < 6; i++ {
			for j := 0; j < 3; j++ {
				reserved[size-11+j][i] = true
				reserved[i][size-11+j] = true
			}
		}
	}
}

func placeData(m, reserved [][]bool, codewords []byte) {
	size := len(m)
	bitIndex := 0
	totalBits := len(codewords) * 8
	directionUp := true
	for col := size - 1; col > 0; col -= 2 {
		if col == 6 {
			col--
		}
		for step := 0; step < size; step++ {
			row := step
			if directionUp {
				row = size - 1 - step
			}
			for c := 0; c < 2; c++ {
				cc := col - c
				if reserved[row][cc] {
					continue
				}
				bit := false
				if bitIndex < totalBits {
					bit = (codewords[bitIndex/8]>>(7-uint(bitIndex%8)))&1 == 1
					bitIndex++
				}
				m[row][cc] = bit
			}
		}
		directionUp = !directionUp
	}
}

func applyMask(m, reserved [][]bool, mask int) {
	size := len(m)
	for row := 0; row < size; row++ {
		for col := 0; col < size; col++ {
			if reserved[row][col] {
				continue
			}
			var invert bool
			switch mask {
			case 0:
				invert = (row+col)%2 == 0
			case 1:
				invert = row%2 == 0
			case 2:
				invert = col%3 == 0
			case 3:
				invert = (row+col)%3 == 0
			case 4:
				invert = (row/2+col/3)%2 == 0
			case 5:
				invert = (row*col)%2+(row*col)%3 == 0
			case 6:
				invert = ((row*col)%2+(row*col)%3)%2 == 0
			case 7:
				invert = ((row+col)%2+(row*col)%3)%2 == 0
			}
			if invert {
				m[row][col] = !m[row][col]
			}
		}
	}
}

func formatBits(mask int) int {
	data := mask // level M = 0b00
	rem := data
	for i := 0; i < 10; i++ {
		rem = (rem << 1) ^ ((rem >> 9) * 0x537)
	}
	return (data<<10 | rem) ^ 0x5412
}

func versionBits(version int) int {
	rem := version
	for i := 0; i < 12; i++ {
		rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
	}
	return version<<12 | rem
}

func drawFormatBits(m [][]bool, mask int) {
	size := len(m)
	bits := formatBits(mask)
	bit := func(i int) bool { return (bits>>uint(i))&1 == 1 }

	for i := 0; i < 6; i++ {
		m[i][8] = bit(i)
	}
	m[7][8] = bit(6)
	m[8][8] = bit(7)
	m[8][7] = bit(8)
	for i := 9; i < 15; i++ {
		m[8][14-i] = bit(i)
	}

	for i := 0; i < 8; i++ {
		m[8][size-1-i] = bit(i)
	}
	for i := 8; i < 15; i++ {
		m[size-15+i][8] = bit(i)
	}

	m[size-8][8] = true
}

func drawVersionBits(m [][]bool, version int) {
	if version < 7 {
		return
	}
	size := len(m)
	bits := versionBits(version)
	for i := 0; i < 18; i++ {
		bit := (bits>>uint(i))&1 == 1
		row := i / 3
		col := i%3 + size - 11
		m[row][col] = bit
		m[col][row] = bit
	}
}

func penalty(m [][]bool) int {
	size := len(m)
	score := 0

	runScore := func(line []bool) int {
		score := 0
		run := 1
		for i := 1; i < len(line); i++ {
			if line[i] == line[i-1] {
				run++
			} else {
				if run >= 5 {
					score += 3 + (run - 5)
				}
				run = 1
			}
		}
		if run >= 5 {
			score += 3 + (run - 5)
		}
		return score
	}

	for i := 0; i < size; i++ {
		row := make([]bool, size)
		col := make([]bool, size)
		for j := 0; j < size; j++ {
			row[j] = m[i][j]
			col[j] = m[j][i]
		}
		score += runScore(row)
		score += runScore(col)
	}

	for i := 0; i < size-1; i++ {
		for j := 0; j < size-1; j++ {
			c := m[i][j]
			if c == m[i][j+1] && c == m[i+1][j] && c == m[i+1][j+1] {
				score += 3
			}
		}
	}

	pattern1 := []bool{true, false, true, true, true, false, true, false, false, false, false}
	pattern2 := []bool{false, false, false, false, true, false, true, true, true, false, true}
	matches := func(line []bool, start int, pattern []bool) bool {
		for k, v := range pattern {
			if line[start+k] != v {
				return false
			}
		}
		return true
	}
	for i := 0; i < size; i++ {
		row := make([]bool, size)
		col := make([]bool, size)
		for j := 0; j < size; j++ {
			row[j] = m[i][j]
			col[j] = m[j][i]
		}
		for j := 0; j+11 <= size; j++ {
			if matches(row, j, pattern1) || matches(row, j, pattern2) {
				score += 40
			}
			if matches(col, j, pattern1) || matches(col, j, pattern2) {
				score += 40
			}
		}
	}

	dark := 0
	for i := 0; i < size; i++ {
		for j := 0; j < size; j++ {
			if m[i][j] {
				dark++
			}
		}
	}
	percent := float64(dark) * 100 / float64(size*size)
	score += int(math.Floor(math.Abs(percent-50)/5)) * 10

	return score
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
