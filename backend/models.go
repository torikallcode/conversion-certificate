package main

import "time"

type Permohonan struct {
	ID             int64     `json:"id"`
	NomorTiket     string    `json:"nomor_tiket"`
	PemohonID      int64     `json:"pemohon_id"`
	NamaPemohon    string    `json:"nama_pemohon"`
	JenisPemohon   string    `json:"jenis_pemohon"`
	NamaBadanHukum string    `json:"nama_badan_hukum"`
	Dikuasakan     bool      `json:"dikuasakan"`
	NIK            string    `json:"nik"`
	Alamat         string    `json:"alamat"`
	NoHP           string    `json:"no_hp"`
	JenisHak       string    `json:"jenis_hak"`
	NomorHak       string    `json:"nomor_hak"`
	Lokasi         string    `json:"lokasi"`
	Status         string    `json:"status"`
	Catatan        string    `json:"catatan"`
	DibuatPada     time.Time `json:"dibuat_pada"`
	DiperbaruiPada time.Time `json:"diperbarui_pada"`
}

type SertipikatAnalog struct {
	ID              int64      `json:"id"`
	PermohonanID    int64      `json:"permohonan_id"`
	JenisHak        string     `json:"jenis_hak"`
	NomorHak        string     `json:"nomor_hak"`
	PemegangHak     string     `json:"pemegang_hak"`
	LuasM2          *float64   `json:"luas_m2"`
	Lokasi          string     `json:"lokasi"`
	TahunTerbit     *int       `json:"tahun_terbit"`
	SerahTerimaPada *time.Time `json:"serah_terima_pada"`
	StatusWarkah    string     `json:"status_warkah"`
	KTPCocok        bool       `json:"ktp_cocok"`
	KKCocok         bool       `json:"kk_cocok"`
	BeritaAcara     string     `json:"berita_acara"`
	DiperbaruiPada  time.Time  `json:"diperbarui_pada"`
}

type Dokumen struct {
	ID           int64     `json:"id"`
	PermohonanID int64     `json:"permohonan_id"`
	Jenis        string    `json:"jenis"`
	Path         string    `json:"-"`
	NamaAsli     string    `json:"nama_asli"`
	Mime         string    `json:"mime"`
	Ukuran       int64     `json:"ukuran"`
	Checksum     string    `json:"checksum_sha256"`
	DiunggahOleh *int64    `json:"diunggah_oleh"`
	DibuatPada   time.Time `json:"dibuat_pada"`
}

type PNBP struct {
	ID           int64     `json:"id"`
	PermohonanID int64     `json:"permohonan_id"`
	StatusBayar  string    `json:"status_bayar"`
	Nominal      float64   `json:"nominal"`
	DicatatOleh  *int64    `json:"dicatat_oleh"`
	DicatatPada  time.Time `json:"dicatat_pada"`
}

type SertipikatElektronik struct {
	ID              int64     `json:"id"`
	PermohonanID    int64     `json:"permohonan_id"`
	Nomor           string    `json:"nomor"`
	Edisi           string    `json:"edisi"`
	KodeVerifikasi  string    `json:"kode_verifikasi"`
	HashDokumen     string    `json:"hash_dokumen"`
	DiterbitkanOleh *int64    `json:"diterbitkan_oleh"`
	TanggalTerbit   time.Time `json:"tanggal_terbit"`
	Simulasi        bool      `json:"simulasi"`
}

type RiwayatStatus struct {
	ID           int64     `json:"id"`
	PermohonanID int64     `json:"permohonan_id"`
	DariStatus   string    `json:"dari_status"`
	KeStatus     string    `json:"ke_status"`
	OlehUserID   *int64    `json:"oleh_user_id"`
	OlehNama     string    `json:"oleh_nama"`
	Catatan      string    `json:"catatan"`
	Waktu        time.Time `json:"waktu"`
}

type Kelengkapan struct {
	DokumenWajib      []string `json:"dokumen_wajib"`
	DokumenAda        []string `json:"dokumen_ada"`
	Kurang            []string `json:"kurang"`
	Lengkap           bool     `json:"lengkap"`
	DataAnalogLengkap bool     `json:"data_analog_lengkap"`
	PNBPLunas         bool     `json:"pnbp_lunas"`
	KTPCocok          bool     `json:"ktp_cocok"`
	KKCocok           bool     `json:"kk_cocok"`
}

var statusList = []string{
	"Diajukan",
	"Berkas diterima",
	"Menunggu validasi",
	"Perlu perbaikan",
	"Ditolak",
	"Terbit (simulasi)",
}

func requiredDocs(jenisPemohon string, dikuasakan bool) []string {
	docs := []string{"ktp", "kk", "foto_sertipikat"}
	if dikuasakan {
		docs = append(docs, "surat_kuasa")
	}
	if jenisPemohon == "badan_hukum" {
		docs = append(docs, "akta_pendirian")
	}
	return docs
}

func maskNIK(nik string) string {
	if len(nik) <= 6 {
		if nik == "" {
			return ""
		}
		return "******"
	}
	if len(nik) <= 10 {
		return nik[:3] + "******"
	}
	return nik[:6] + "******" + nik[len(nik)-4:]
}

func maskNama(nama string) string {
	parts := []rune(nama)
	if len(parts) <= 2 {
		return string(parts)
	}
	out := []rune{parts[0]}
	for i := 1; i < len(parts); i++ {
		if parts[i] == ' ' {
			out = append(out, ' ')
			if i+1 < len(parts) {
				out = append(out, parts[i+1])
				i++
			}
			continue
		}
		out = append(out, '*')
	}
	return string(out)
}
