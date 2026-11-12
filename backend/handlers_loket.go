package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"
)

func (a *App) serahTerima(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		KTPCocok    bool   `json:"ktp_cocok"`
		KKCocok     bool   `json:"kk_cocok"`
		BeritaAcara string `json:"berita_acara"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.BeritaAcara = strings.TrimSpace(req.BeritaAcara)
	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if p.Status != "Diajukan" {
		fail(w, http.StatusBadRequest, "serah terima hanya dapat dicatat saat status Diajukan")
		return
	}

	tx, err := a.db.Begin()
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memulai transaksi")
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`INSERT INTO sertipikat_analog (permohonan_id, serah_terima_pada, status_warkah, ktp_cocok, kk_cocok, berita_acara)
		 VALUES ($1, now(), 'warkah', $2, $3, $4)
		 ON CONFLICT (permohonan_id) DO UPDATE SET
			serah_terima_pada = now(), status_warkah = 'warkah',
			ktp_cocok = EXCLUDED.ktp_cocok, kk_cocok = EXCLUDED.kk_cocok,
			berita_acara = EXCLUDED.berita_acara, diperbarui_pada = now()`,
		p.ID, req.KTPCocok, req.KKCocok, req.BeritaAcara)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal mencatat serah terima")
		return
	}
	if _, err := tx.Exec(`UPDATE permohonan SET status='Berkas diterima', diperbarui_pada=now() WHERE id=$1`, p.ID); err != nil {
		fail(w, http.StatusInternalServerError, "gagal memperbarui status")
		return
	}
	note := "Sertipikat asli diterima di loket"
	if req.BeritaAcara != "" {
		note += ": " + req.BeritaAcara
	}
	if err := a.recordRiwayat(tx, p.ID, p.Status, "Berkas diterima", u.ID, note); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan riwayat")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}
	a.audit(r, u.ID, "serah_terima.dicatat", fmt.Sprintf("permohonan=%d tiket=%s", p.ID, p.NomorTiket))
	writeJSON(w, http.StatusOK, Envelope{"pesan": "Serah terima sertipikat asli berhasil dicatat"})
}

func (a *App) updateSertipikatAnalog(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		JenisHak    string  `json:"jenis_hak"`
		NomorHak    string  `json:"nomor_hak"`
		PemegangHak string  `json:"pemegang_hak"`
		LuasM2      float64 `json:"luas_m2"`
		Lokasi      string  `json:"lokasi"`
		TahunTerbit int     `json:"tahun_terbit"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.JenisHak = strings.TrimSpace(req.JenisHak)
	req.NomorHak = strings.TrimSpace(req.NomorHak)
	req.PemegangHak = strings.TrimSpace(req.PemegangHak)
	req.Lokasi = strings.TrimSpace(req.Lokasi)
	if req.JenisHak == "" || req.NomorHak == "" || req.PemegangHak == "" || req.Lokasi == "" {
		fail(w, http.StatusBadRequest, "jenis hak, nomor hak, pemegang hak, dan lokasi wajib diisi")
		return
	}
	if req.LuasM2 <= 0 {
		fail(w, http.StatusBadRequest, "luas harus lebih dari 0 m2")
		return
	}
	currentYear := time.Now().Year()
	if req.TahunTerbit < 1900 || req.TahunTerbit > currentYear {
		fail(w, http.StatusBadRequest, "tahun terbit tidak valid")
		return
	}

	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if p.Status != "Berkas diterima" && p.Status != "Diajukan" {
		fail(w, http.StatusBadRequest, "data sertipikat analog hanya dapat diubah sebelum validasi")
		return
	}

	_, err = a.db.Exec(
		`INSERT INTO sertipikat_analog (permohonan_id, jenis_hak, nomor_hak, pemegang_hak, luas_m2, lokasi, tahun_terbit)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (permohonan_id) DO UPDATE SET
			jenis_hak = EXCLUDED.jenis_hak, nomor_hak = EXCLUDED.nomor_hak,
			pemegang_hak = EXCLUDED.pemegang_hak, luas_m2 = EXCLUDED.luas_m2,
			lokasi = EXCLUDED.lokasi, tahun_terbit = EXCLUDED.tahun_terbit,
			diperbarui_pada = now()`,
		p.ID, req.JenisHak, req.NomorHak, req.PemegangHak, req.LuasM2, req.Lokasi, req.TahunTerbit)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan data sertipikat analog")
		return
	}
	a.audit(r, u.ID, "sertipikat_analog.diubah", fmt.Sprintf("permohonan=%d nomor_hak=%s", p.ID, req.NomorHak))
	writeJSON(w, http.StatusOK, Envelope{"pesan": "Data sertipikat analog berhasil disimpan"})
}

func (a *App) catatPNBP(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		StatusBayar string  `json:"status_bayar"`
		Nominal     float64 `json:"nominal"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	if req.StatusBayar != "belum" && req.StatusBayar != "lunas" {
		fail(w, http.StatusBadRequest, "status bayar harus belum atau lunas")
		return
	}
	if req.Nominal < 0 {
		fail(w, http.StatusBadRequest, "nominal tidak valid")
		return
	}
	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	_, err = a.db.Exec(
		`INSERT INTO pnbp (permohonan_id, status_bayar, nominal, dicatat_oleh)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (permohonan_id) DO UPDATE SET
			status_bayar = EXCLUDED.status_bayar, nominal = EXCLUDED.nominal,
			dicatat_oleh = EXCLUDED.dicatat_oleh, dicatat_pada = now()`,
		p.ID, req.StatusBayar, req.Nominal, u.ID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal mencatat PNBP")
		return
	}
	a.audit(r, u.ID, "pnbp.dicatat", fmt.Sprintf("permohonan=%d status=%s nominal=%.2f", p.ID, req.StatusBayar, req.Nominal))
	writeJSON(w, http.StatusOK, Envelope{"pesan": "Status PNBP berhasil dicatat (simulasi)"})
}

func (a *App) ajukanValidasi(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		Catatan string `json:"catatan"`
	}
	_ = decodeJSON(r, &req)

	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if p.Status != "Berkas diterima" {
		fail(w, http.StatusBadRequest, "permohonan harus berstatus Berkas diterima untuk diajukan ke validasi")
		return
	}
	detail, err := a.loadDetail(p)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memeriksa kelengkapan berkas")
		return
	}
	kel := detail["kelengkapan"].(Kelengkapan)
	if !kel.Lengkap {
		fail(w, http.StatusBadRequest, "berkas persyaratan belum lengkap: "+strings.Join(kel.Kurang, ", "))
		return
	}
	if !kel.DataAnalogLengkap {
		fail(w, http.StatusBadRequest, "data sertipikat analog belum lengkap")
		return
	}

	tx, err := a.db.Begin()
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memulai transaksi")
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE permohonan SET status='Menunggu validasi', diperbarui_pada=now() WHERE id=$1`, p.ID); err != nil {
		fail(w, http.StatusInternalServerError, "gagal memperbarui status")
		return
	}
	if err := a.recordRiwayat(tx, p.ID, p.Status, "Menunggu validasi", u.ID, strings.TrimSpace(req.Catatan)); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan riwayat")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}
	a.audit(r, u.ID, "status.diubah", fmt.Sprintf("permohonan=%d Berkas diterima->Menunggu validasi", p.ID))
	writeJSON(w, http.StatusOK, Envelope{"pesan": "Permohonan diajukan ke petugas verifikasi"})
}
