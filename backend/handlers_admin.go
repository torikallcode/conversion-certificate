package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func (a *App) listUsers(w http.ResponseWriter, r *http.Request) {
	page, perPage := pageParams(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	where := "WHERE 1=1"
	args := []any{}
	if q != "" {
		where += " AND (nama ILIKE $1 OR email ILIKE $1)"
		args = append(args, "%"+q+"%")
	}
	var total int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM users `+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menghitung pengguna")
		return
	}
	rows, err := a.db.Query(
		`SELECT id, nama, email, role, aktif, nik, no_hp, dibuat_pada FROM users `+where+
			` ORDER BY dibuat_pada DESC LIMIT $`+strconv.Itoa(len(args)+1)+` OFFSET $`+strconv.Itoa(len(args)+2),
		append(args, perPage, (page-1)*perPage)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat pengguna")
		return
	}
	defer rows.Close()
	items := []*User{}
	for rows.Next() {
		u := &User{}
		if err := rows.Scan(&u.ID, &u.Nama, &u.Email, &u.Role, &u.Aktif, &u.NIK, &u.NoHP, &u.DibuatPada); err != nil {
			fail(w, http.StatusInternalServerError, "gagal membaca data pengguna")
			return
		}
		items = append(items, u)
	}
	writeJSON(w, http.StatusOK, Envelope{"items": items, "total": total, "page": page, "per_page": perPage})
}

func (a *App) createUser(w http.ResponseWriter, r *http.Request) {
	admin := currentUser(r)
	var req struct {
		Nama     string `json:"nama"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
		NIK      string `json:"nik"`
		NoHP     string `json:"no_hp"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.Nama = strings.TrimSpace(req.Nama)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Role = strings.TrimSpace(req.Role)
	if req.Nama == "" || req.Email == "" {
		fail(w, http.StatusBadRequest, "nama dan email wajib diisi")
		return
	}
	validRole := false
	for _, role := range []string{"masyarakat", "loket", "verifikasi", "admin"} {
		if req.Role == role {
			validRole = true
		}
	}
	if !validRole {
		fail(w, http.StatusBadRequest, "peran tidak valid")
		return
	}
	if len(req.Password) < 8 {
		fail(w, http.StatusBadRequest, "kata sandi minimal 8 karakter")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memproses kata sandi")
		return
	}
	var id int64
	err = a.db.QueryRow(
		`INSERT INTO users (nama, email, password_hash, role, nik, no_hp)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		req.Nama, req.Email, string(hash), req.Role, req.NIK, req.NoHP,
	).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			fail(w, http.StatusConflict, "email sudah terdaftar")
			return
		}
		fail(w, http.StatusInternalServerError, "gagal membuat pengguna")
		return
	}
	a.audit(r, admin.ID, "user.dibuat", fmt.Sprintf("user=%d role=%s", id, req.Role))
	u, _ := a.loadUser(id)
	writeJSON(w, http.StatusCreated, Envelope{"user": u})
}

func (a *App) updateUser(w http.ResponseWriter, r *http.Request) {
	admin := currentUser(r)
	id, ok := parseID(r, "id")
	if !ok {
		fail(w, http.StatusBadRequest, "ID pengguna tidak valid")
		return
	}
	var req struct {
		Nama  string `json:"nama"`
		Role  string `json:"role"`
		Aktif *bool  `json:"aktif"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.Nama = strings.TrimSpace(req.Nama)
	req.Role = strings.TrimSpace(req.Role)
	if req.Role != "" {
		validRole := false
		for _, role := range []string{"masyarakat", "loket", "verifikasi", "admin"} {
			if req.Role == role {
				validRole = true
			}
		}
		if !validRole {
			fail(w, http.StatusBadRequest, "peran tidak valid")
			return
		}
	}
	if req.Aktif != nil && !*req.Aktif && id == admin.ID {
		fail(w, http.StatusBadRequest, "Anda tidak dapat menonaktifkan akun sendiri")
		return
	}
	if req.Nama == "" && req.Role == "" && req.Aktif == nil {
		fail(w, http.StatusBadRequest, "tidak ada perubahan yang dikirim")
		return
	}

	res, err := a.db.Exec(
		`UPDATE users SET
			nama = COALESCE(NULLIF($1,''), nama),
			role = COALESCE(NULLIF($2,''), role),
			aktif = COALESCE($3, aktif)
		 WHERE id=$4`,
		req.Nama, req.Role, req.Aktif, id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memperbarui pengguna")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(w, http.StatusNotFound, "pengguna tidak ditemukan")
		return
	}
	a.audit(r, admin.ID, "user.diubah", fmt.Sprintf("user=%d role=%s", id, req.Role))
	u, err := a.loadUser(id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat pengguna")
		return
	}
	writeJSON(w, http.StatusOK, Envelope{"user": u})
}

func (a *App) listAudit(w http.ResponseWriter, r *http.Request) {
	page, perPage := pageParams(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	where := "WHERE 1=1"
	args := []any{}
	if q != "" {
		where += " AND (a.aksi ILIKE $1 OR a.objek ILIKE $1 OR u.nama ILIKE $1)"
		args = append(args, "%"+q+"%")
	}
	var total int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.id=a.user_id `+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menghitung log audit")
		return
	}
	rows, err := a.db.Query(
		`SELECT a.id, a.user_id, COALESCE(u.nama,'-'), a.aksi, a.objek, a.ip, a.waktu
		 FROM audit_log a LEFT JOIN users u ON u.id=a.user_id `+where+
			` ORDER BY a.waktu DESC, a.id DESC LIMIT $`+strconv.Itoa(len(args)+1)+` OFFSET $`+strconv.Itoa(len(args)+2),
		append(args, perPage, (page-1)*perPage)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat log audit")
		return
	}
	defer rows.Close()
	items := []Envelope{}
	for rows.Next() {
		var id int64
		var userID *int64
		var nama, aksi, objek, ip string
		var waktu time.Time
		if err := rows.Scan(&id, &userID, &nama, &aksi, &objek, &ip, &waktu); err != nil {
			fail(w, http.StatusInternalServerError, "gagal membaca log audit")
			return
		}
		items = append(items, Envelope{
			"id": id, "user_id": userID, "nama": nama, "aksi": aksi,
			"objek": objek, "ip": ip, "waktu": waktu,
		})
	}
	writeJSON(w, http.StatusOK, Envelope{"items": items, "total": total, "page": page, "per_page": perPage})
}

func (a *App) dashboard(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	counts := map[string]int{}
	rows, err := a.db.Query(`SELECT status, COUNT(*) FROM permohonan GROUP BY status`)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat statistik")
		return
	}
	total := 0
	for rows.Next() {
		var status string
		var n int
		if rows.Scan(&status, &n) == nil {
			counts[status] = n
			total += n
		}
	}
	rows.Close()
	for _, s := range statusList {
		if _, ok := counts[s]; !ok {
			counts[s] = 0
		}
	}

	var avgDays float64
	a.db.QueryRow(
		`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.tanggal_terbit - p.dibuat_pada)) / 86400), 0)
		 FROM sertipikat_elektronik c JOIN permohonan p ON p.id = c.permohonan_id`).Scan(&avgDays)

	var totalUsers, bulanIni int
	if u.Role == "admin" {
		a.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&totalUsers)
	}
	a.db.QueryRow(`SELECT COUNT(*) FROM permohonan WHERE dibuat_pada >= date_trunc('month', now())`).Scan(&bulanIni)

	recent := []Envelope{}
	if u.Role == "admin" {
		auditRows, err := a.db.Query(
			`SELECT a.id, COALESCE(u.nama,'-'), a.aksi, a.objek, a.waktu
			 FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
			 ORDER BY a.waktu DESC, a.id DESC LIMIT 8`)
		if err == nil {
			for auditRows.Next() {
				var id int64
				var nama, aksi, objek string
				var waktu time.Time
				if auditRows.Scan(&id, &nama, &aksi, &objek, &waktu) == nil {
					recent = append(recent, Envelope{"id": id, "nama": nama, "aksi": aksi, "objek": objek, "waktu": waktu})
				}
			}
			auditRows.Close()
		}
	}

	writeJSON(w, http.StatusOK, Envelope{
		"counts":         counts,
		"total":          total,
		"total_users":    totalUsers,
		"bulan_ini":      bulanIni,
		"rata_rata_hari": avgDays,
		"aktivitas_baru": recent,
	})
}
