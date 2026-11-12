package main

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type seedRiwayat struct {
	dari, ke, catatan string
	oleh              int64
	waktu             time.Time
}

func seedDemo(db *sql.DB, cfg Config) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	demoUsers := []struct {
		nama, email, role, password, nik, hp string
	}{
		{"Admin Sistem", "admin@demo.test", "admin", "Admin123!", "", "081200000001"},
		{"Petugas Loket", "loket@demo.test", "loket", "Loket123!", "", "081200000002"},
		{"Petugas Verifikasi", "verifikasi@demo.test", "verifikasi", "Verifikasi123!", "", "081200000003"},
		{"Siti Rahmawati", "masyarakat@demo.test", "masyarakat", "Masyarakat123!", "3201012345670001", "081200000004"},
	}
	ids := map[string]int64{}
	for _, du := range demoUsers {
		hash, err := bcrypt.GenerateFromPassword([]byte(du.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		var id int64
		if err := tx.QueryRow(
			`INSERT INTO users (nama, email, password_hash, role, nik, no_hp)
			 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
			du.nama, du.email, string(hash), du.role, du.nik, du.hp,
		).Scan(&id); err != nil {
			return err
		}
		ids[du.role] = id
	}

	pemohonID := ids["masyarakat"]
	loketID := ids["loket"]
	verifikasiID := ids["verifikasi"]
	now := time.Now()

	type seedPerm struct {
		tiket, jenisPemohon, badan, nik, alamat, hp, jenisHak, nomorHak, lokasi string
		luas                                                                    float64
		tahun                                                                   int
		status, catatan                                                         string
		dibuat                                                                  time.Time
		dikuasakan                                                              bool
		withDocs                                                                bool
		serahTerima                                                             bool
		pnbpLunas                                                               bool
		issueCert                                                               bool
	}

	seeds := []seedPerm{
		{
			tiket: "AM-20261103-1042", jenisPemohon: "perorangan",
			nik: "3201012345670001", alamat: "Jl. Merdeka No. 12, Sukabumi", hp: "081200000004",
			jenisHak: "Hak Milik", nomorHak: "01234/Sukamaju", lokasi: "Desa Sukamaju, Kec. Cibadak, Kab. Sukabumi",
			luas: 120, tahun: 2015, status: "Diajukan", dibuat: now.Add(-2 * time.Hour), withDocs: true,
		},
		{
			tiket: "AM-20261101-0915", jenisPemohon: "perorangan",
			nik: "3201012345670001", alamat: "Jl. Merdeka No. 12, Sukabumi", hp: "081200000004",
			jenisHak: "Hak Milik", nomorHak: "05678/Cibadak", lokasi: "Desa Cibadak, Kec. Cibadak, Kab. Sukabumi",
			luas: 245.5, tahun: 2012, status: "Menunggu validasi",
			catatan: "Berkas lengkap, menunggu validasi petugas",
			dibuat:  now.Add(-72 * time.Hour), withDocs: true, serahTerima: true, pnbpLunas: true,
		},
		{
			tiket: "AM-20261028-0733", jenisPemohon: "badan_hukum", badan: "PT Tanah Makmur Sejahtera",
			nik: "", alamat: "Jl. Sudirman Kav. 5, Jakarta Selatan", hp: "081200000004",
			jenisHak: "Hak Guna Bangunan", nomorHak: "02311/Jakarta", lokasi: "Kel. Kuningan Barat, Kec. Mampang, Jakarta Selatan",
			luas: 1250, tahun: 2010, status: "Terbit (simulasi)",
			catatan: "Disetujui, draf sertipikat elektronik diterbitkan",
			dibuat:  now.Add(-14 * 24 * time.Hour), withDocs: true, serahTerima: true, pnbpLunas: true, issueCert: true,
		},
		{
			tiket: "AM-20261102-1188", jenisPemohon: "perorangan",
			nik: "3201012345670001", alamat: "Jl. Merdeka No. 12, Sukabumi", hp: "081200000004",
			jenisHak: "Hak Milik", nomorHak: "09987/Sukaraja", lokasi: "Desa Sukaraja, Kec. Sukaraja, Kab. Sukabumi",
			luas: 90, tahun: 2005, status: "Perlu perbaikan",
			catatan: "Foto sertipikat buram, mohon unggah ulang dengan resolusi minimal 300 dpi",
			dibuat:  now.Add(-96 * time.Hour), withDocs: true, serahTerima: true, pnbpLunas: true,
		},
		{
			tiket: "AM-20261025-0601", jenisPemohon: "perorangan",
			nik: "3201012345670001", alamat: "Jl. Merdeka No. 12, Sukabumi", hp: "081200000004",
			jenisHak: "Hak Milik", nomorHak: "07765/Bogor", lokasi: "Desa Ciawi, Kec. Ciawi, Kab. Bogor",
			luas: 300, tahun: 1998, status: "Ditolak",
			catatan: "Data pemegang hak pada sertipikat analog tidak sesuai dengan KTP pemohon",
			dibuat:  now.Add(-20 * 24 * time.Hour), withDocs: true, serahTerima: true, pnbpLunas: true,
		},
	}

	for _, sp := range seeds {
		diperbarui := sp.dibuat.Add(6 * time.Hour)
		var permID int64
		if err := tx.QueryRow(
			`INSERT INTO permohonan (nomor_tiket, pemohon_id, jenis_pemohon, nama_badan_hukum,
				dikuasakan, nik, alamat, no_hp, status, catatan, dibuat_pada, diperbarui_pada)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
			sp.tiket, pemohonID, sp.jenisPemohon, sp.badan, sp.dikuasakan, sp.nik, sp.alamat, sp.hp,
			sp.status, sp.catatan, sp.dibuat, diperbarui,
		).Scan(&permID); err != nil {
			return err
		}

		pemegang := "Siti Rahmawati"
		if sp.jenisPemohon == "badan_hukum" {
			pemegang = sp.badan
		}
		statusWarkah := "belum"
		var serah any
		ktpCocok, kkCocok := false, false
		beritaAcara := ""
		if sp.serahTerima {
			statusWarkah = "warkah"
			serah = sp.dibuat.Add(24 * time.Hour)
			ktpCocok = true
			kkCocok = true
			beritaAcara = "Sertipikat asli diterima petugas loket dan dicatat sebagai warkah. Contoh data simulasi."
		}
		if _, err := tx.Exec(
			`INSERT INTO sertipikat_analog (permohonan_id, jenis_hak, nomor_hak, pemegang_hak, luas_m2,
				lokasi, tahun_terbit, serah_terima_pada, status_warkah, ktp_cocok, kk_cocok, berita_acara)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			permID, sp.jenisHak, sp.nomorHak, pemegang, sp.luas, sp.lokasi, sp.tahun,
			serah, statusWarkah, ktpCocok, kkCocok, beritaAcara,
		); err != nil {
			return err
		}

		if sp.withDocs {
			docs := []string{"ktp", "kk", "foto_sertipikat"}
			if sp.jenisPemohon == "badan_hukum" {
				docs = append(docs, "akta_pendirian")
			}
			if sp.serahTerima {
				docs = append(docs, "scan_sertipikat")
			}
			for _, jenis := range docs {
				if err := seedDocument(tx, cfg, permID, jenis, pemohonID, sp.dibuat.Add(30*time.Minute)); err != nil {
					return err
				}
			}
		}

		if sp.pnbpLunas {
			if _, err := tx.Exec(
				`INSERT INTO pnbp (permohonan_id, status_bayar, nominal, dicatat_oleh, dicatat_pada)
				 VALUES ($1,'lunas',500000,$2,$3)`,
				permID, loketID, sp.dibuat.Add(2*time.Hour),
			); err != nil {
				return err
			}
		}

		riwayat := []seedRiwayat{
			{"", "Diajukan", "Permohonan diajukan oleh pemohon", pemohonID, sp.dibuat},
		}
		if sp.serahTerima {
			riwayat = append(riwayat,
				seedRiwayat{"Diajukan", "Berkas diterima", "Sertipikat asli diterima di loket, KTP dan KK cocok", loketID, sp.dibuat.Add(24 * time.Hour)},
				seedRiwayat{"Berkas diterima", "Menunggu validasi", "Berkas lengkap, diajukan ke petugas verifikasi", loketID, sp.dibuat.Add(30 * time.Hour)},
			)
		}
		switch sp.status {
		case "Perlu perbaikan":
			riwayat = append(riwayat, seedRiwayat{"Menunggu validasi", "Perlu perbaikan", sp.catatan, verifikasiID, sp.dibuat.Add(34 * time.Hour)})
		case "Ditolak":
			riwayat = append(riwayat, seedRiwayat{"Menunggu validasi", "Ditolak", sp.catatan, verifikasiID, sp.dibuat.Add(34 * time.Hour)})
		}
		for _, r := range riwayat {
			if _, err := tx.Exec(
				`INSERT INTO riwayat_status (permohonan_id, dari_status, ke_status, oleh_user_id, catatan, waktu)
				 VALUES ($1,$2,$3,$4,$5,$6)`,
				permID, r.dari, r.ke, r.oleh, r.catatan, r.waktu,
			); err != nil {
				return err
			}
		}

		if sp.issueCert {
			p := &Permohonan{ID: permID, NomorTiket: sp.tiket, JenisPemohon: sp.jenisPemohon, NamaBadanHukum: sp.badan}
			if _, err := terbitkanSertifikat(tx, p, verifikasiID); err != nil {
				return err
			}
			if _, err := tx.Exec(
				`INSERT INTO riwayat_status (permohonan_id, dari_status, ke_status, oleh_user_id, catatan, waktu)
				 VALUES ($1,'Menunggu validasi','Terbit (simulasi)',$2,$3,$4)`,
				permID, verifikasiID, "Disetujui: data sesuai buku tanah, draf sertipikat elektronik diterbitkan", sp.dibuat.Add(36*time.Hour),
			); err != nil {
				return err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	fmt.Println("data demo disiapkan (4 akun, 5 permohonan contoh)")
	return nil
}

func seedDocument(tx *sql.Tx, cfg Config, permID int64, jenis string, userID int64, dibuat time.Time) error {
	img := placeholderPNG(jenis)
	dir := filepath.Join(cfg.StorageDir, "permohonan", strconv.FormatInt(permID, 10))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	name := "contoh-" + jenis + ".png"
	full := filepath.Join(dir, name)
	if err := os.WriteFile(full, img, 0o640); err != nil {
		return err
	}
	sum := sha256.Sum256(img)
	rel := filepath.ToSlash(filepath.Join("permohonan", strconv.FormatInt(permID, 10), name))
	_, err := tx.Exec(
		`INSERT INTO dokumen (permohonan_id, jenis, path, nama_asli, mime, ukuran, checksum_sha256, diunggah_oleh, dibuat_pada)
		 VALUES ($1,$2,$3,$4,'image/png',$5,$6,$7,$8)`,
		permID, jenis, rel, "contoh-"+jenis+".png", len(img), hex.EncodeToString(sum[:]), userID, dibuat)
	return err
}

var seedColors = map[string]color.RGBA{
	"ktp":             {219, 234, 254, 255},
	"kk":              {220, 252, 231, 255},
	"foto_sertipikat": {254, 249, 195, 255},
	"scan_sertipikat": {252, 231, 243, 255},
	"surat_kuasa":     {237, 233, 254, 255},
	"akta_pendirian":  {224, 242, 254, 255},
}

func placeholderPNG(jenis string) []byte {
	bg, ok := seedColors[jenis]
	if !ok {
		bg = color.RGBA{229, 231, 235, 255}
	}
	w, h := 900, 560
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	drawRect(img, 0, 0, w, h, bg)
	drawRect(img, 30, 30, w-30, h-30, color.RGBA{255, 255, 255, 255})
	drawRect(img, 30, 30, w-30, 110, color.RGBA{31, 64, 53, 255})
	lines := []struct{ x, y, width, height int }{
		{70, 160, 300, 14}, {70, 200, 420, 10}, {70, 230, 380, 10},
		{70, 260, 340, 10}, {70, 310, 760, 10}, {70, 340, 700, 10},
		{70, 370, 720, 10}, {70, 420, 300, 10}, {70, 470, 640, 10},
	}
	for _, l := range lines {
		drawRect(img, l.x, l.y, l.x+l.width, l.y+l.height, color.RGBA{203, 213, 225, 255})
	}
	drawRect(img, 700, 150, 830, 270, color.RGBA{226, 232, 240, 255})
	drawRect(img, 700, 150, 830, 160, color.RGBA{148, 163, 184, 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil
	}
	return buf.Bytes()
}

func drawRect(img *image.RGBA, x1, y1, x2, y2 int, c color.RGBA) {
	if x1 < 0 {
		x1 = 0
	}
	if y1 < 0 {
		y1 = 0
	}
	if x2 > img.Bounds().Dx() {
		x2 = img.Bounds().Dx()
	}
	if y2 > img.Bounds().Dy() {
		y2 = img.Bounds().Dy()
	}
	for y := y1; y < y2; y++ {
		for x := x1; x < x2; x++ {
			img.SetRGBA(x, y, c)
		}
	}
}
