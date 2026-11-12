package main

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"image/png"
	"math"
	"strings"
	"time"
)

// PDF generator sederhana agar API tidak bergantung pada pustaka PDF eksternal.

const (
	ptPerMM = 2.834645669
	pageW   = 595.28
	pageH   = 841.89
)

type pdfImage struct {
	name   string
	width  int
	height int
	data   []byte
}

type pdfBuilder struct {
	content bytes.Buffer
	images  []*pdfImage
}

func mm(v float64) float64 { return v * ptPerMM }

func (p *pdfBuilder) topY(topMM float64) float64 { return pageH - mm(topMM) }

func escapePDF(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `(`, `\(`)
	s = strings.ReplaceAll(s, `)`, `\)`)
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}

func (p *pdfBuilder) textAt(xPt, yPt, size float64, bold bool, r, g, b float64, s string) {
	font := "/F1"
	if bold {
		font = "/F2"
	}
	fmt.Fprintf(&p.content, "q %.3f %.3f %.3f rg BT %s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET Q\n",
		r, g, b, font, size, xPt, yPt, escapePDF(s))
}

func (p *pdfBuilder) Text(xMM, topMM, size float64, bold bool, r, g, b float64, s string) {
	p.textAt(mm(xMM), p.topY(topMM), size, bold, r, g, b, s)
}

func (p *pdfBuilder) TextCenter(size float64, topMM float64, bold bool, r, g, b float64, s string) {
	w := textWidthMM(s, size)
	p.textAt((pageW-w)/2, p.topY(topMM), size, bold, r, g, b, s)
}

func textWidthMM(s string, sizePt float64) float64 {
	sum := 0.0
	for _, c := range s {
		switch {
		case c == ' ':
			sum += 0.278
		case c >= 'A' && c <= 'Z':
			sum += 0.667
		case c >= 'a' && c <= 'z':
			sum += 0.5
		case c >= '0' && c <= '9':
			sum += 0.556
		case c == '.' || c == ',' || c == '\'' || c == '|' || c == ':' || c == ';':
			sum += 0.278
		default:
			sum += 0.5
		}
	}
	return sum * sizePt * 0.352777778
}

func (p *pdfBuilder) Wrap(xMM, topMM, widthMM, size, lineMM float64, bold bool, r, g, b float64, text string) float64 {
	words := strings.Fields(text)
	line := ""
	y := topMM
	for _, w := range words {
		candidate := w
		if line != "" {
			candidate = line + " " + w
		}
		if textWidthMM(candidate, size) > widthMM && line != "" {
			p.Text(xMM, y, size, bold, r, g, b, line)
			y += lineMM
			line = w
		} else {
			line = candidate
		}
	}
	if line != "" {
		p.Text(xMM, y, size, bold, r, g, b, line)
		y += lineMM
	}
	return y
}

func (p *pdfBuilder) Line(x1, y1, x2, y2, width float64, r, g, b float64) {
	fmt.Fprintf(&p.content, "q %.3f %.3f %.3f RG %.2f w %.2f %.2f m %.2f %.2f l S Q\n",
		r, g, b, width, mm(x1), p.topY(y1), mm(x2), p.topY(y2))
}

func (p *pdfBuilder) addPNG(data []byte) (*pdfImage, error) {
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	raw := make([]byte, 0, w*h*3)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			raw = append(raw, byte(r>>8), byte(g>>8), byte(b>>8))
		}
	}
	var compressed bytes.Buffer
	zw := zlib.NewWriter(&compressed)
	if _, err := zw.Write(raw); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	im := &pdfImage{
		name:   fmt.Sprintf("Im%d", len(p.images)+1),
		width:  w,
		height: h,
		data:   compressed.Bytes(),
	}
	p.images = append(p.images, im)
	return im, nil
}

func (p *pdfBuilder) Image(im *pdfImage, xMM, topMM, wMM, hMM float64) {
	y := pageH - mm(topMM) - mm(hMM)
	fmt.Fprintf(&p.content, "q %.3f 0 0 %.3f %.3f %.3f cm /%s Do Q\n",
		mm(wMM), mm(hMM), mm(xMM), y, im.name)
}

func (p *pdfBuilder) Watermark(text string, cxMM, cyMM, angle, size float64, gray float64) {
	rad := angle * math.Pi / 180
	cos, sin := math.Cos(rad), math.Sin(rad)
	w := textWidthMM(text, size)
	fmt.Fprintf(&p.content,
		"q %.4f %.4f %.4f %.4f %.2f %.2f cm BT %.2f %.2f %.2f rg /F2 %.1f Tf %.2f 0 Td (%s) Tj ET Q\n",
		cos, sin, -sin, cos, mm(cxMM), pageH-mm(cyMM),
		gray, gray, gray, size, -w/2, escapePDF(text))
}

func (p *pdfBuilder) Build() []byte {
	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

	objects := [][]byte{}
	addObj := func(body []byte) int {
		objects = append(objects, body)
		return len(objects)
	}

	contentObj := addObj(nil) // placeholder, diisi setelah semua gambar terdaftar
	fontRegular := addObj([]byte("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"))
	fontBold := addObj([]byte("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"))
	catalog := addObj(nil)
	pages := addObj(nil)
	page := addObj(nil)

	imageObjNums := map[string]int{}
	for _, im := range p.images {
		var body bytes.Buffer
		fmt.Fprintf(&body, "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n",
			im.width, im.height, len(im.data))
		body.Write(im.data)
		body.WriteString("\nendstream")
		imageObjNums[im.name] = addObj(body.Bytes())
	}

	stream := p.content.Bytes()
	objects[contentObj-1] = []byte(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))

	xobjectEntries := strings.Builder{}
	for name, num := range imageObjNums {
		fmt.Fprintf(&xobjectEntries, "/%s %d 0 R ", name, num)
	}
	resources := fmt.Sprintf(
		"<< /Font << /F1 %d 0 R /F2 %d 0 R >> /XObject << %s>> >>",
		fontRegular, fontBold, xobjectEntries.String())

	objects[catalog-1] = []byte(fmt.Sprintf("<< /Type /Catalog /Pages %d 0 R >>", pages))
	objects[pages-1] = []byte(fmt.Sprintf("<< /Type /Pages /Kids [%d 0 R] /Count 1 >>", page))
	objects[page-1] = []byte(fmt.Sprintf(
		"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f] /Resources %s /Contents %d 0 R >>",
		pages, pageW, pageH, resources, contentObj))

	offsets := make([]int, len(objects)+1)
	for i, body := range objects {
		offsets[i+1] = out.Len()
		fmt.Fprintf(&out, "%d 0 obj\n", i+1)
		out.Write(body)
		out.WriteString("\nendobj\n")
	}

	xrefPos := out.Len()
	fmt.Fprintf(&out, "xref\n0 %d\n", len(objects)+1)
	out.WriteString("0000000000 65535 f \n")
	for i := 1; i <= len(objects); i++ {
		fmt.Fprintf(&out, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, catalog, xrefPos)
	return out.Bytes()
}

func buildSertipikatPDF(cfg Config, p *Permohonan, sa *SertipikatAnalog, cert *SertipikatElektronik, pemohon *User) ([]byte, error) {
	pdf := &pdfBuilder{}

	qrPNG, err := qrEncodePNG(cfg.PublicBaseURL+"/verifikasi/"+cert.KodeVerifikasi, 8)
	if err != nil {
		return nil, err
	}
	qrImg, err := pdf.addPNG(qrPNG)
	if err != nil {
		return nil, err
	}

	pdf.Watermark("SIMULASI", 105, 190, 42, 58, 0.86)

	pdf.TextCenter(9, 15, true, 0.63, 0.12, 0.12, "SIMULASI - BUKAN SERTIPIKAT ELEKTRONIK RESMI")
	pdf.TextCenter(11, 22, true, 0.08, 0.08, 0.08, "KEMENTERIAN AGRARIA DAN TATA RUANG")
	pdf.TextCenter(11, 28, true, 0.08, 0.08, 0.08, "BADAN PERTANAHAN NASIONAL")
	pdf.TextCenter(10, 34, false, 0.08, 0.08, 0.08, "REPUBLIK INDONESIA")
	pdf.TextCenter(15, 45, true, 0.05, 0.05, 0.05, "DRAF SERTIPIKAT ELEKTRONIK")
	pdf.TextCenter(9.5, 52, false, 0.2, 0.2, 0.2, fmt.Sprintf("Nomor: %s   |   Edisi: %s", cert.Nomor, cert.Edisi))
	pdf.Line(18, 58, 192, 58, 0.9, 0.12, 0.31, 0.24)

	pdf.Text(18, 69, 11, true, 0.1, 0.1, 0.1, "DATA SERTIPIKAT")

	luas := "-"
	if sa.LuasM2 != nil {
		luas = fmt.Sprintf("%.2f m2", *sa.LuasM2)
	}
	tahun := "-"
	if sa.TahunTerbit != nil {
		tahun = fmt.Sprintf("%d", *sa.TahunTerbit)
	}
	pemegang := sa.PemegangHak
	if p.JenisPemohon == "badan_hukum" && p.NamaBadanHukum != "" {
		pemegang = p.NamaBadanHukum
	}

	rows := [][2]string{
		{"Jenis Hak", sa.JenisHak},
		{"Nomor Hak", sa.NomorHak},
		{"Pemegang Hak", pemegang},
		{"Luas Tanah", luas},
		{"Lokasi", sa.Lokasi},
		{"Tahun Terbit", tahun},
		{"Nomor Tiket", p.NomorTiket},
		{"Pemohon", pemohon.Nama},
		{"Tanggal Terbit Draf", cert.TanggalTerbit.In(time.Local).Format("2 January 2006 15:04 WIB")},
	}
	y := 77.0
	for _, row := range rows {
		pdf.Text(18, y, 9, false, 0.36, 0.36, 0.36, row[0])
		next := pdf.Wrap(70, y, 82, 10, 5.2, true, 0.08, 0.08, 0.08, row[1])
		if next-y < 6.5 {
			y += 6.5
		} else {
			y = next + 1.3
		}
	}

	pdf.Image(qrImg, 150, 67, 42, 42)
	pdf.Text(144, 113, 7, false, 0.3, 0.3, 0.3, "Pindai QR untuk")
	pdf.Text(144, 116.5, 7, false, 0.3, 0.3, 0.3, "cek keaslian dokumen.")

	y += 4
	pdf.Line(18, y, 192, y, 0.5, 0.7, 0.7, 0.7)
	y += 6
	pdf.Text(18, y, 10, true, 0.1, 0.1, 0.1, "KETERANGAN SIMULASI")
	y += 6
	y = pdf.Wrap(18, y, 174, 9, 4.6, false, 0.2, 0.2, 0.2,
		"Dokumen ini dihasilkan oleh prototipe sistem alih media sertipikat analog ke elektronik. "+
			"Dokumen BUKAN sertipikat elektronik resmi, tidak ditandatangani secara elektronik tersertifikasi BSrE, "+
			"dan tidak memiliki akibat hukum. Gunakan kode verifikasi di halaman cek keaslian untuk memastikan "+
			"dokumen ini terdaftar pada sistem simulasi.")
	y += 3
	pdf.Text(18, y, 7.5, true, 0.15, 0.15, 0.15, "Kode verifikasi: "+cert.KodeVerifikasi)
	y += 5
	pdf.Text(18, y, 7, false, 0.25, 0.25, 0.25, "Hash SHA-256 dokumen:")
	hashLine := cert.HashDokumen
	for len(hashLine) > 0 {
		chunk := hashLine
		if len(chunk) > 80 {
			chunk = hashLine[:80]
		}
		y += 4
		pdf.Text(18, y, 6.5, false, 0.25, 0.25, 0.25, chunk)
		hashLine = hashLine[len(chunk):]
	}
	y += 6
	pdf.Text(18, y, 7, false, 0.25, 0.25, 0.25,
		"Diterbitkan oleh petugas verifikasi (simulasi) pada "+
			cert.TanggalTerbit.In(time.Local).Format("02-01-2006 15:04:05 WIB"))

	pdf.Line(128, 222, 182, 222, 0.5, 0.55, 0.55, 0.55)
	pdf.Text(128, 218, 8, false, 0.3, 0.3, 0.3, "Petugas Verifikasi (simulasi)")
	pdf.Text(128, 227, 7, false, 0.45, 0.45, 0.45, "Ditandatangani secara elektronik")
	pdf.Text(128, 231, 7, false, 0.45, 0.45, 0.45, "oleh sistem prototipe")

	pdf.Line(18, 277, 192, 277, 0.4, 0.75, 0.75, 0.75)
	pdf.TextCenter(7, 283, false, 0.45, 0.45, 0.45,
		"Prototipe Alih Media Sertipikat Analog ke Elektronik - data fiktif untuk demonstrasi")

	return pdf.Build(), nil
}
