package main

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const permohonanSelect = `SELECT p.id, p.nomor_tiket, p.pemohon_id, u.nama, p.jenis_pemohon,
	p.nama_badan_hukum, p.dikuasakan, p.nik, p.alamat, p.no_hp, p.status, p.catatan,
	p.dibuat_pada, p.diperbarui_pada,
	COALESCE(sa.jenis_hak,''), COALESCE(sa.nomor_hak,''), COALESCE(sa.lokasi,'')
	FROM permohonan p
	JOIN users u ON u.id = p.pemohon_id
	LEFT JOIN sertipikat_analog sa ON sa.permohonan_id = p.id`

type scanner interface {
	Scan(dest ...any) error
}

func scanPermohonan(row scanner) (*Permohonan, error) {
	p := &Permohonan{}
	err := row.Scan(
		&p.ID, &p.NomorTiket, &p.PemohonID, &p.NamaPemohon, &p.JenisPemohon,
		&p.NamaBadanHukum, &p.Dikuasakan, &p.NIK, &p.Alamat, &p.NoHP, &p.Status, &p.Catatan,
		&p.DibuatPada, &p.DiperbaruiPada, &p.JenisHak, &p.NomorHak, &p.Lokasi,
	)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (a *App) findPermohonan(id int64) (*Permohonan, error) {
	return scanPermohonan(a.db.QueryRow(permohonanSelect+` WHERE p.id=$1`, id))
}

func canAccess(p *Permohonan, u *User) bool {
	if u.Role == "masyarakat" {
		return p.PemohonID == u.ID
	}
	return true
}

func parseID(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	return id, err == nil && id > 0
}

func pageParams(r *http.Request) (page, perPage int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ = strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 10
	}
	return
}

func countPermohonan(db *sql.DB, where string, args []any) (map[string]int, int) {
	rows, err := db.Query(`SELECT p.status, COUNT(*) FROM permohonan p `+where+` GROUP BY p.status`, args...)
	if err != nil {
		return map[string]int{}, 0
	}
	defer rows.Close()
	counts := map[string]int{}
	total := 0
	for rows.Next() {
		var status string
		var n int
		if rows.Scan(&status, &n) == nil {
			counts[status] = n
			total += n
		}
	}
	for _, s := range statusList {
		if _, ok := counts[s]; !ok {
			counts[s] = 0
		}
	}
	return counts, total
}

func (a *App) listPermohonan(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	query := r.URL.Query()

	where := "WHERE 1=1"
	args := []any{}
	argN := 0
	add := func(clause string, val any) {
		argN++
		where += " " + strings.ReplaceAll(clause, "?", fmt.Sprintf("$%d", argN))
		args = append(args, val)
	}

	if u.Role == "masyarakat" {
		add("AND p.pemohon_id = ?", u.ID)
	}
	if q := strings.TrimSpace(query.Get("q")); q != "" {
		argN++
		where += fmt.Sprintf(` AND (p.nomor_tiket ILIKE $%d OR EXISTS (
			SELECT 1 FROM users ux WHERE ux.id = p.pemohon_id AND ux.nama ILIKE $%d)
			OR EXISTS (SELECT 1 FROM sertipikat_analog sx WHERE sx.permohonan_id = p.id
				AND (sx.nomor_hak ILIKE $%d OR sx.lokasi ILIKE $%d)))`, argN, argN, argN, argN)
		args = append(args, "%"+q+"%")
	}

	itemWhere := where
	itemArgs := append([]any{}, args...)
	if status := strings.TrimSpace(query.Get("status")); status != "" && status != "semua" {
		valid := false
		for _, s := range statusList {
			if s == status {
				valid = true
			}
		}
		if valid {
			itemArgs = append(itemArgs, status)
			itemWhere += fmt.Sprintf(" AND p.status = $%d", len(itemArgs))
		}
	}

	page, perPage := pageParams(r)
	offset := (page - 1) * perPage

	rows, err := a.db.Query(permohonanSelect+` `+itemWhere+` ORDER BY p.dibuat_pada DESC LIMIT $`+
		strconv.Itoa(len(itemArgs)+1)+` OFFSET $`+strconv.Itoa(len(itemArgs)+2),
		append(itemArgs, perPage, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat daftar permohonan")
		return
	}
	items := []*Permohonan{}
	for rows.Next() {
		p, err := scanPermohonan(rows)
		if err != nil {
			rows.Close()
			fail(w, http.StatusInternalServerError, "gagal membaca data permohonan")
			return
		}
		items = append(items, p)
	}
	rows.Close()

	counts, total := countPermohonan(a.db, where, args)
	writeJSON(w, http.StatusOK, Envelope{
		"items":    items,
		"total":    total,
		"page":     page,
		"per_page": perPage,
		"counts":   counts,
	})
}

type createPermohonanReq struct {
	JenisPemohon   string `json:"jenis_pemohon"`
	NamaBadanHukum string `json:"nama_badan_hukum"`
	Dikuasakan     bool   `json:"dikuasakan"`
	NIK            string `json:"nik"`
	Alamat         string `json:"alamat"`
	NoHP           string `json:"no_hp"`
	JenisHak       string `json:"jenis_hak"`
	NomorHak       string `json:"nomor_hak"`
	Lokasi         string `json:"lokasi"`
}

func randomDigits(n int) string {
	out := make([]byte, n)
	for i := range out {
		v, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			out[i] = byte('0' + (time.Now().UnixNano()+int64(i))%10)
			continue
		}
		out[i] = byte('0' + v.Int64())
	}
	return string(out)
}

func (a *App) generateTicket() (string, error) {
	for i := 0; i < 10; i++ {
		ticket := fmt.Sprintf("AM-%s-%s", time.Now().Format("20060102"), randomDigits(4))
		var exists bool
		if err := a.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM permohonan WHERE nomor_tiket=$1)`, ticket).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return ticket, nil
		}
	}
	return "", errors.New("gagal membuat nomor tiket")
}

func (a *App) createPermohonan(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var req createPermohonanReq
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.JenisPemohon = strings.TrimSpace(req.JenisPemohon)
	req.NamaBadanHukum = strings.TrimSpace(req.NamaBadanHukum)
	req.NIK = strings.TrimSpace(req.NIK)
	req.Alamat = strings.TrimSpace(req.Alamat)
	req.NoHP = strings.TrimSpace(req.NoHP)
	req.JenisHak = strings.TrimSpace(req.JenisHak)
	req.NomorHak = strings.TrimSpace(req.NomorHak)
	req.Lokasi = strings.TrimSpace(req.Lokasi)

	if req.JenisPemohon != "perorangan" && req.JenisPemohon != "badan_hukum" {
		fail(w, http.StatusBadRequest, "jenis pemohon harus perorangan atau badan hukum")
		return
	}
	if req.JenisPemohon == "badan_hukum" && req.NamaBadanHukum == "" {
		fail(w, http.StatusBadRequest, "nama badan hukum wajib diisi")
		return
	}
	if req.JenisPemohon == "perorangan" && !isDigits(req.NIK, 16) {
		fail(w, http.StatusBadRequest, "NIK harus 16 angka")
		return
	}
	if req.Alamat == "" {
		fail(w, http.StatusBadRequest, "alamat wajib diisi")
		return
	}
	if req.JenisHak == "" || req.NomorHak == "" || req.Lokasi == "" {
		fail(w, http.StatusBadRequest, "jenis hak, nomor hak, dan lokasi wajib diisi")
		return
	}

	ticket, err := a.generateTicket()
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal membuat nomor tiket")
		return
	}

	tx, err := a.db.Begin()
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memulai transaksi")
		return
	}
	defer tx.Rollback()

	var id int64
	err = tx.QueryRow(
		`INSERT INTO permohonan (nomor_tiket, pemohon_id, jenis_pemohon, nama_badan_hukum,
			dikuasakan, nik, alamat, no_hp, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Diajukan') RETURNING id`,
		ticket, u.ID, req.JenisPemohon, req.NamaBadanHukum, req.Dikuasakan, req.NIK, req.Alamat, req.NoHP,
	).Scan(&id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan permohonan")
		return
	}

	pemegang := u.Nama
	if req.JenisPemohon == "badan_hukum" {
		pemegang = req.NamaBadanHukum
	}
	if _, err := tx.Exec(
		`INSERT INTO sertipikat_analog (permohonan_id, jenis_hak, nomor_hak, pemegang_hak, lokasi)
		 VALUES ($1,$2,$3,$4,$5)`,
		id, req.JenisHak, req.NomorHak, pemegang, req.Lokasi,
	); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan data sertipikat")
		return
	}
	if err := a.recordRiwayat(tx, id, "", "Diajukan", u.ID, "Permohonan diajukan oleh pemohon"); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan riwayat")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan permohonan")
		return
	}

	a.audit(r, u.ID, "permohonan.dibuat", fmt.Sprintf("permohonan=%d tiket=%s", id, ticket))
	p, err := a.findPermohonan(id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat permohonan")
		return
	}
	writeJSON(w, http.StatusCreated, Envelope{"permohonan": p, "pesan": "Permohonan berhasil dibuat"})
}

func (a *App) loadDetail(p *Permohonan) (Envelope, error) {
	pemohon, err := a.loadUser(p.PemohonID)
	if err != nil {
		return nil, err
	}

	var analog *SertipikatAnalog
	sa := &SertipikatAnalog{}
	var luas sql.NullFloat64
	var tahun sql.NullInt64
	var serah sql.NullTime
	err = a.db.QueryRow(
		`SELECT id, permohonan_id, jenis_hak, nomor_hak, pemegang_hak, luas_m2, lokasi, tahun_terbit,
			serah_terima_pada, status_warkah, ktp_cocok, kk_cocok, berita_acara, diperbarui_pada
		 FROM sertipikat_analog WHERE permohonan_id=$1`, p.ID,
	).Scan(&sa.ID, &sa.PermohonanID, &sa.JenisHak, &sa.NomorHak, &sa.PemegangHak, &luas, &sa.Lokasi,
		&tahun, &serah, &sa.StatusWarkah, &sa.KTPCocok, &sa.KKCocok, &sa.BeritaAcara, &sa.DiperbaruiPada)
	if err == nil {
		if luas.Valid {
			sa.LuasM2 = &luas.Float64
		}
		if tahun.Valid {
			t := int(tahun.Int64)
			sa.TahunTerbit = &t
		}
		if serah.Valid {
			sa.SerahTerimaPada = &serah.Time
		}
		analog = sa
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	dokumen := []*Dokumen{}
	rows, err := a.db.Query(
		`SELECT id, permohonan_id, jenis, path, nama_asli, mime, ukuran, checksum_sha256, diunggah_oleh, dibuat_pada
		 FROM dokumen WHERE permohonan_id=$1 ORDER BY dibuat_pada`, p.ID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		d := &Dokumen{}
		if err := rows.Scan(&d.ID, &d.PermohonanID, &d.Jenis, &d.Path, &d.NamaAsli, &d.Mime, &d.Ukuran,
			&d.Checksum, &d.DiunggahOleh, &d.DibuatPada); err != nil {
			rows.Close()
			return nil, err
		}
		dokumen = append(dokumen, d)
	}
	rows.Close()

	var pnbp *PNBP
	pb := &PNBP{}
	err = a.db.QueryRow(
		`SELECT id, permohonan_id, status_bayar, nominal, dicatat_oleh, dicatat_pada
		 FROM pnbp WHERE permohonan_id=$1`, p.ID,
	).Scan(&pb.ID, &pb.PermohonanID, &pb.StatusBayar, &pb.Nominal, &pb.DicatatOleh, &pb.DicatatPada)
	if err == nil {
		pnbp = pb
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	riwayat := []*RiwayatStatus{}
	rows, err = a.db.Query(
		`SELECT r.id, r.permohonan_id, r.dari_status, r.ke_status, r.oleh_user_id,
			COALESCE(u.nama,'Sistem'), r.catatan, r.waktu
		 FROM riwayat_status r LEFT JOIN users u ON u.id = r.oleh_user_id
		 WHERE r.permohonan_id=$1 ORDER BY r.waktu, r.id`, p.ID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		ri := &RiwayatStatus{}
		if err := rows.Scan(&ri.ID, &ri.PermohonanID, &ri.DariStatus, &ri.KeStatus, &ri.OlehUserID,
			&ri.OlehNama, &ri.Catatan, &ri.Waktu); err != nil {
			rows.Close()
			return nil, err
		}
		riwayat = append(riwayat, ri)
	}
	rows.Close()

	var cert *SertipikatElektronik
	ce := &SertipikatElektronik{}
	err = a.db.QueryRow(
		`SELECT id, permohonan_id, nomor, edisi, kode_verifikasi, hash_dokumen,
			diterbitkan_oleh, tanggal_terbit, simulasi
		 FROM sertipikat_elektronik WHERE permohonan_id=$1`, p.ID,
	).Scan(&ce.ID, &ce.PermohonanID, &ce.Nomor, &ce.Edisi, &ce.KodeVerifikasi, &ce.HashDokumen,
		&ce.DiterbitkanOleh, &ce.TanggalTerbit, &ce.Simulasi)
	if err == nil {
		cert = ce
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	wajib := requiredDocs(p.JenisPemohon, p.Dikuasakan)
	ada := map[string]bool{}
	for _, d := range dokumen {
		ada[d.Jenis] = true
	}
	kurang := []string{}
	adaList := []string{}
	for _, jenis := range wajib {
		if ada[jenis] {
			adaList = append(adaList, jenis)
		} else {
			kurang = append(kurang, jenis)
		}
	}
	dataLengkap := analog != nil && analog.PemegangHak != "" && analog.JenisHak != "" &&
		analog.NomorHak != "" && analog.Lokasi != "" && analog.LuasM2 != nil && analog.TahunTerbit != nil

	kelengkapan := Kelengkapan{
		DokumenWajib:      wajib,
		DokumenAda:        adaList,
		Kurang:            kurang,
		Lengkap:           len(kurang) == 0,
		DataAnalogLengkap: dataLengkap,
		PNBPLunas:         pnbp != nil && pnbp.StatusBayar == "lunas",
		KTPCocok:          analog != nil && analog.KTPCocok,
		KKCocok:           analog != nil && analog.KKCocok,
	}

	return Envelope{
		"permohonan":            p,
		"pemohon":               pemohon,
		"sertipikat_analog":     analog,
		"dokumen":               dokumen,
		"pnbp":                  pnbp,
		"riwayat":               riwayat,
		"sertipikat_elektronik": cert,
		"kelengkapan":           kelengkapan,
	}, nil
}

func (a *App) getPermohonanDetail(w http.ResponseWriter, r *http.Request) {
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
		fail(w, http.StatusForbidden, "Anda tidak berhak melihat permohonan ini")
		return
	}
	detail, err := a.loadDetail(p)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat detail permohonan")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (a *App) uploadDokumen(w http.ResponseWriter, r *http.Request) {
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
		fail(w, http.StatusForbidden, "Anda tidak berhak mengunggah berkas pada permohonan ini")
		return
	}
	if u.Role == "masyarakat" && p.Status != "Diajukan" && p.Status != "Perlu perbaikan" {
		fail(w, http.StatusBadRequest, "berkas hanya dapat diunggah saat status Diajukan atau Perlu perbaikan")
		return
	}

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		fail(w, http.StatusBadRequest, "form unggahan tidak valid")
		return
	}
	jenis := strings.TrimSpace(r.FormValue("jenis"))
	if !allowedJenisDokumen[jenis] {
		fail(w, http.StatusBadRequest, "jenis dokumen tidak dikenal")
		return
	}
	if u.Role == "masyarakat" && jenis == "scan_sertipikat" {
		fail(w, http.StatusForbidden, "scan sertipikat asli diunggah oleh petugas loket")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		fail(w, http.StatusBadRequest, "berkas tidak ditemukan pada form")
		return
	}
	defer file.Close()

	saved, err := a.saveUpload(p.ID, header)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}

	var dokID int64
	err = a.db.QueryRow(
		`INSERT INTO dokumen (permohonan_id, jenis, path, nama_asli, mime, ukuran, checksum_sha256, diunggah_oleh)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		p.ID, jenis, saved.RelPath, saved.NamaAsli, saved.Mime, saved.Size, saved.Checksum, u.ID,
	).Scan(&dokID)
	if err != nil {
		a.removeFile(saved.RelPath)
		fail(w, http.StatusInternalServerError, "gagal menyimpan data berkas")
		return
	}
	a.audit(r, u.ID, "dokumen.diunggah", fmt.Sprintf("permohonan=%d dokumen=%d jenis=%s", p.ID, dokID, jenis))

	d := &Dokumen{ID: dokID, PermohonanID: p.ID, Jenis: jenis, NamaAsli: saved.NamaAsli,
		Mime: saved.Mime, Ukuran: saved.Size, Checksum: saved.Checksum}
	writeJSON(w, http.StatusCreated, Envelope{"dokumen": d, "pesan": "Berkas berhasil diunggah"})
}

func (a *App) downloadDokumen(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID dokumen tidak valid")
		return
	}
	d := &Dokumen{}
	err := a.db.QueryRow(
		`SELECT id, permohonan_id, jenis, path, nama_asli, mime, ukuran, checksum_sha256, diunggah_oleh, dibuat_pada
		 FROM dokumen WHERE id=$1`, id,
	).Scan(&d.ID, &d.PermohonanID, &d.Jenis, &d.Path, &d.NamaAsli, &d.Mime, &d.Ukuran,
		&d.Checksum, &d.DiunggahOleh, &d.DibuatPada)
	if err != nil {
		fail(w, http.StatusNotFound, "dokumen tidak ditemukan")
		return
	}
	p, err := a.findPermohonan(d.PermohonanID)
	if err != nil || !canAccess(p, u) {
		fail(w, http.StatusForbidden, "Anda tidak berhak mengunduh berkas ini")
		return
	}
	full, err := a.absolutePath(d.Path)
	if err != nil {
		fail(w, http.StatusBadRequest, "path berkas tidak valid")
		return
	}
	f, err := os.Open(full)
	if err != nil {
		fail(w, http.StatusNotFound, "berkas tidak ditemukan di penyimpanan")
		return
	}
	defer f.Close()

	disposition := "inline"
	if r.URL.Query().Get("unduh") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Type", d.Mime)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, sanitizeFilename(d.NamaAsli)))
	http.ServeContent(w, r, d.NamaAsli, d.DibuatPada, f)
	a.audit(r, u.ID, "dokumen.diunduh", fmt.Sprintf("permohonan=%d dokumen=%d", p.ID, d.ID))
}

func sanitizeFilename(name string) string {
	name = strings.ReplaceAll(name, `"`, "")
	name = strings.ReplaceAll(name, `\`, "_")
	name = strings.ReplaceAll(name, "/", "_")
	if name == "" {
		return "berkas"
	}
	return name
}

func (a *App) kirimPerbaikan(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID permohonan tidak valid")
		return
	}
	var req struct {
		Catatan string `json:"catatan"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.Catatan = strings.TrimSpace(req.Catatan)
	if req.Catatan == "" {
		fail(w, http.StatusBadRequest, "catatan perbaikan wajib diisi")
		return
	}
	p, err := a.findPermohonan(id)
	if err != nil || p.PemohonID != u.ID {
		fail(w, http.StatusNotFound, "permohonan tidak ditemukan")
		return
	}
	if p.Status != "Perlu perbaikan" {
		fail(w, http.StatusBadRequest, "permohonan tidak dalam status Perlu perbaikan")
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
	if err := a.recordRiwayat(tx, p.ID, p.Status, "Menunggu validasi", u.ID, "Perbaikan dikirim pemohon: "+req.Catatan); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan riwayat")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan perubahan")
		return
	}
	a.audit(r, u.ID, "status.diubah", fmt.Sprintf("permohonan=%d %s->Menunggu validasi", p.ID, p.Status))
	writeJSON(w, http.StatusOK, Envelope{"pesan": "Perbaikan berhasil dikirim untuk divalidasi ulang"})
}
