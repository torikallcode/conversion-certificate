package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const kodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func randomKode(n int) string {
	out := make([]byte, n)
	for i := range out {
		v, err := rand.Int(rand.Reader, big.NewInt(int64(len(kodeAlphabet))))
		if err != nil {
			out[i] = kodeAlphabet[(time.Now().UnixNano()+int64(i))%int64(len(kodeAlphabet))]
			continue
		}
		out[i] = kodeAlphabet[v.Int64()]
	}
	return string(out)
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func terbitkanSertifikat(tx *sql.Tx, p *Permohonan, userID int64) (*SertipikatElektronik, error) {
	var jenisHak, nomorHak, pemegangHak, lokasi string
	var luas sql.NullFloat64
	err := tx.QueryRow(
		`SELECT jenis_hak, nomor_hak, pemegang_hak, luas_m2, lokasi FROM sertipikat_analog WHERE permohonan_id=$1`,
		p.ID,
	).Scan(&jenisHak, &nomorHak, &pemegangHak, &luas, &lokasi)
	if err != nil {
		return nil, fmt.Errorf("data sertipikat analog tidak lengkap: %w", err)
	}

	now := time.Now().UTC()
	nomor := fmt.Sprintf("SE-%06d/%d", p.ID, now.Year())
	edisi := "1"
	kode := ""
	for i := 0; i < 10; i++ {
		candidate := randomKode(12)
		var exists bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM sertipikat_elektronik WHERE kode_verifikasi=$1)`, candidate).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			kode = candidate
			break
		}
	}
	if kode == "" {
		return nil, fmt.Errorf("gagal membuat kode verifikasi")
	}

	canonical := strings.Join([]string{
		strconv.FormatInt(p.ID, 10),
		p.NomorTiket,
		nomor,
		edisi,
		kode,
		jenisHak,
		nomorHak,
		pemegangHak,
		fmt.Sprintf("%.2f", luas.Float64),
		lokasi,
		now.Format(time.RFC3339),
	}, "|")
	hash := sha256Hex(canonical)

	cert := &SertipikatElektronik{
		PermohonanID:   p.ID,
		Nomor:          nomor,
		Edisi:          edisi,
		KodeVerifikasi: kode,
		HashDokumen:    hash,
		TanggalTerbit:  now,
		Simulasi:       true,
	}
	err = tx.QueryRow(
		`INSERT INTO sertipikat_elektronik (permohonan_id, nomor, edisi, kode_verifikasi, hash_dokumen, diterbitkan_oleh, tanggal_terbit, simulasi)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
		p.ID, nomor, edisi, kode, hash, userID, now,
	).Scan(&cert.ID)
	if err != nil {
		return nil, err
	}
	cert.DiterbitkanOleh = &userID
	return cert, nil
}

func (a *App) keputusan(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		Keputusan string `json:"keputusan"`
		Catatan   string `json:"catatan"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.Catatan = strings.TrimSpace(req.Catatan)
	if req.Keputusan != "setujui" && req.Keputusan != "tolak" && req.Keputusan != "perbaikan" {
		fail(w, http.StatusBadRequest, "keputusan harus setujui, tolak, atau perbaikan")
		return
	}
	if req.Catatan == "" {
		fail(w, http.StatusBadRequest, "catatan keputusan wajib diisi")
		return
	}

	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if p.Status != "Menunggu validasi" {
		fail(w, http.StatusBadRequest, "permohonan tidak dalam status Menunggu validasi")
		return
	}

	var penginput int64
	err = a.db.QueryRow(
		`SELECT COALESCE(oleh_user_id, 0) FROM riwayat_status
		 WHERE permohonan_id=$1 AND ke_status='Menunggu validasi'
		 ORDER BY waktu DESC, id DESC LIMIT 1`, p.ID,
	).Scan(&penginput)
	if err != nil && err != sql.ErrNoRows {
		fail(w, http.StatusInternalServerError, "gagal memeriksa riwayat")
		return
	}
	if penginput == u.ID {
		fail(w, http.StatusForbidden, "pemisahan tugas: petugas yang menginput tidak boleh memvalidasi permohonan ini")
		return
	}

	if req.Keputusan == "setujui" {
		var statusPNBP string
		err := a.db.QueryRow(`SELECT status_bayar FROM pnbp WHERE permohonan_id=$1`, p.ID).Scan(&statusPNBP)
		if err != nil {
			fail(w, http.StatusBadRequest, "PNBP belum dicatat oleh loket")
			return
		}
		if statusPNBP != "lunas" {
			fail(w, http.StatusBadRequest, "PNBP belum lunas, sertipikat elektronik belum dapat diterbitkan")
			return
		}
	}

	tx, err := a.db.Begin()
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memulai transaksi")
		return
	}
	defer tx.Rollback()

	var newStatus, note string
	switch req.Keputusan {
	case "setujui":
		newStatus = "Terbit (simulasi)"
		note = "Disetujui: " + req.Catatan
	case "tolak":
		newStatus = "Ditolak"
		note = "Ditolak: " + req.Catatan
	case "perbaikan":
		newStatus = "Perlu perbaikan"
		note = "Perlu perbaikan: " + req.Catatan
	}

	if _, err := tx.Exec(`UPDATE permohonan SET status=$1, catatan=$2, diperbarui_pada=now() WHERE id=$3`,
		newStatus, req.Catatan, p.ID); err != nil {
		fail(w, http.StatusInternalServerError, "gagal memperbarui status")
		return
	}
	if err := a.recordRiwayat(tx, p.ID, p.Status, newStatus, u.ID, note); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan riwayat")
		return
	}

	var cert *SertipikatElektronik
	if req.Keputusan == "setujui" {
		cert, err = terbitkanSertifikat(tx, p, u.ID)
		if err != nil {
			fail(w, http.StatusInternalServerError, "gagal menerbitkan draf sertipikat elektronik")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan keputusan")
		return
	}

	a.audit(r, u.ID, "keputusan."+req.Keputusan, fmt.Sprintf("permohonan=%d status=%s", p.ID, newStatus))
	if cert != nil {
		a.audit(r, u.ID, "sertipikat.diterbitkan", fmt.Sprintf("permohonan=%d kode=%s", p.ID, cert.KodeVerifikasi))
	}
	writeJSON(w, http.StatusOK, Envelope{
		"pesan":                 "Keputusan berhasil disimpan",
		"status":                newStatus,
		"sertipikat_elektronik": cert,
	})
}

func (a *App) cetakSertipikat(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if !canAccess(p, u) {
		fail(w, http.StatusForbidden, "Anda tidak berhak mengunduh sertipikat ini")
		return
	}
	cert := &SertipikatElektronik{}
	err = a.db.QueryRow(
		`SELECT id, permohonan_id, nomor, edisi, kode_verifikasi, hash_dokumen, diterbitkan_oleh, tanggal_terbit, simulasi
		 FROM sertipikat_elektronik WHERE permohonan_id=$1`, p.ID,
	).Scan(&cert.ID, &cert.PermohonanID, &cert.Nomor, &cert.Edisi, &cert.KodeVerifikasi, &cert.HashDokumen,
		&cert.DiterbitkanOleh, &cert.TanggalTerbit, &cert.Simulasi)
	if err != nil {
		fail(w, http.StatusNotFound, "draf sertipikat elektronik belum diterbitkan")
		return
	}
	sa := &SertipikatAnalog{}
	var luas sql.NullFloat64
	var tahun sql.NullInt64
	err = a.db.QueryRow(
		`SELECT jenis_hak, nomor_hak, pemegang_hak, luas_m2, lokasi, tahun_terbit
		 FROM sertipikat_analog WHERE permohonan_id=$1`, p.ID,
	).Scan(&sa.JenisHak, &sa.NomorHak, &sa.PemegangHak, &luas, &sa.Lokasi, &tahun)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat data sertipikat analog")
		return
	}
	if luas.Valid {
		sa.LuasM2 = &luas.Float64
	}
	if tahun.Valid {
		t := int(tahun.Int64)
		sa.TahunTerbit = &t
	}
	pemohon, err := a.loadUser(p.PemohonID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat data pemohon")
		return
	}

	pdfBytes, err := buildSertipikatPDF(a.cfg, p, sa, cert, pemohon)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal membuat PDF draf sertipikat")
		return
	}

	a.audit(r, u.ID, "sertipikat.diunduh", fmt.Sprintf("permohonan=%d kode=%s", p.ID, cert.KodeVerifikasi))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="draf-sertipikat-%s.pdf"`, cert.KodeVerifikasi))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Write(pdfBytes)
}

func (a *App) verifikasiPublik(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow("verify:"+clientIP(r), 30, 60*1e9) {
		fail(w, http.StatusTooManyRequests, "terlalu banyak permintaan, coba lagi sebentar lagi")
		return
	}
	kode := strings.ToUpper(strings.TrimSpace(r.PathValue("kode")))
	if len(kode) < 6 || len(kode) > 24 {
		fail(w, http.StatusBadRequest, "kode verifikasi tidak valid")
		return
	}

	var nomor, edisi, kodeDB, hash, status, nomorTiket, namaPemohon, jenisPemohon, namaBadan string
	var tanggal time.Time
	var simulasi bool
	var jenisHak, nomorHak, pemegangHak, lokasi sql.NullString
	var luas sql.NullFloat64
	var tahun sql.NullInt64
	err := a.db.QueryRow(
		`SELECT c.nomor, c.edisi, c.kode_verifikasi, c.hash_dokumen, c.tanggal_terbit, c.simulasi,
			p.status, p.nomor_tiket, p.jenis_pemohon, p.nama_badan_hukum, u.nama,
			sa.jenis_hak, sa.nomor_hak, sa.pemegang_hak, sa.luas_m2, sa.lokasi, sa.tahun_terbit
		 FROM sertipikat_elektronik c
		 JOIN permohonan p ON p.id = c.permohonan_id
		 JOIN users u ON u.id = p.pemohon_id
		 LEFT JOIN sertipikat_analog sa ON sa.permohonan_id = p.id
		 WHERE c.kode_verifikasi=$1`, kode,
	).Scan(&nomor, &edisi, &kodeDB, &hash, &tanggal, &simulasi, &status, &nomorTiket,
		&jenisPemohon, &namaBadan, &namaPemohon, &jenisHak, &nomorHak, &pemegangHak, &luas, &lokasi, &tahun)
	if err != nil {
		fail(w, http.StatusNotFound, "kode verifikasi tidak ditemukan atau draf sertipikat belum terbit")
		return
	}

	pemegang := pemegangHak.String
	if jenisPemohon == "badan_hukum" && namaBadan != "" {
		pemegang = namaBadan
	}
	nomorHakMasked := nomorHak.String
	if len(nomorHakMasked) > 4 {
		nomorHakMasked = nomorHakMasked[:len(nomorHakMasked)-3] + "***"
	}

	result := Envelope{
		"valid":             true,
		"simulasi":          simulasi,
		"catatan_simulasi":  "Dokumen ini adalah DRAF SIMULASI, bukan sertipikat elektronik resmi.",
		"nomor":             nomor,
		"edisi":             edisi,
		"kode_verifikasi":   kodeDB,
		"tanggal_terbit":    tanggal,
		"hash_dokumen":      hash,
		"status_permohonan": status,
		"nomor_tiket":       nomorTiket,
		"jenis_hak":         jenisHak.String,
		"nomor_hak":         nomorHakMasked,
		"pemegang_hak":      maskNama(pemegang),
		"lokasi":            lokasi.String,
		"tahun_terbit":      nullInt(tahun),
		"luas_m2":           nullFloat(luas),
	}
	writeJSON(w, http.StatusOK, result)
}

func nullFloat(v sql.NullFloat64) any {
	if v.Valid {
		return v.Float64
	}
	return nil
}

func nullInt(v sql.NullInt64) any {
	if v.Valid {
		return v.Int64
	}
	return nil
}
