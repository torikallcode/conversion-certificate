package main

import (
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerReq struct {
	Nama     string `json:"nama"`
	Email    string `json:"email"`
	Password string `json:"password"`
	NIK      string `json:"nik"`
	NoHP     string `json:"no_hp"`
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow("login:"+clientIP(r), 10, 5*60*1e9) {
		fail(w, http.StatusTooManyRequests, "terlalu banyak percobaan masuk, coba lagi beberapa menit lagi")
		return
	}
	var req loginReq
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	u, hash, err := a.loadUserByEmail(req.Email)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat akun")
		return
	}
	if u == nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		a.audit(r, 0, "login.gagal", "email="+strings.TrimSpace(strings.ToLower(req.Email)))
		fail(w, http.StatusUnauthorized, "email atau kata sandi salah")
		return
	}
	if !u.Aktif {
		fail(w, http.StatusForbidden, "akun dinonaktifkan, hubungi admin")
		return
	}
	token, err := a.issueToken(u)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal membuat token")
		return
	}
	a.audit(r, u.ID, "login", "email="+u.Email)
	writeJSON(w, http.StatusOK, Envelope{"token": token, "user": u})
}

func (a *App) register(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow("register:"+clientIP(r), 5, 60*60*1e9) {
		fail(w, http.StatusTooManyRequests, "terlalu banyak pendaftaran dari perangkat ini")
		return
	}
	var req registerReq
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	req.Nama = strings.TrimSpace(req.Nama)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Nama == "" || req.Email == "" {
		fail(w, http.StatusBadRequest, "nama dan email wajib diisi")
		return
	}
	if len(req.Password) < 8 {
		fail(w, http.StatusBadRequest, "kata sandi minimal 8 karakter")
		return
	}
	if req.NIK != "" && !isDigits(req.NIK, 16) {
		fail(w, http.StatusBadRequest, "NIK harus 16 angka")
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
		 VALUES ($1, $2, $3, 'masyarakat', $4, $5) RETURNING id`,
		req.Nama, req.Email, string(hash), req.NIK, req.NoHP,
	).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "users_email_key") {
			fail(w, http.StatusConflict, "email sudah terdaftar")
			return
		}
		fail(w, http.StatusInternalServerError, "gagal membuat akun")
		return
	}
	u, err := a.loadUser(id)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat akun")
		return
	}
	token, err := a.issueToken(u)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal membuat token")
		return
	}
	a.audit(r, u.ID, "registrasi", "email="+u.Email)
	writeJSON(w, http.StatusCreated, Envelope{"token": token, "user": u})
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, Envelope{"user": currentUser(r)})
}

func (a *App) changePassword(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var req struct {
		PasswordLama string `json:"password_lama"`
		PasswordBaru string `json:"password_baru"`
	}
	if err := decodeJSON(r, &req); err != nil {
		fail(w, http.StatusBadRequest, "permintaan tidak valid")
		return
	}
	if len(req.PasswordBaru) < 8 {
		fail(w, http.StatusBadRequest, "kata sandi baru minimal 8 karakter")
		return
	}
	var hash string
	if err := a.db.QueryRow(`SELECT password_hash FROM users WHERE id=$1`, u.ID).Scan(&hash); err != nil {
		fail(w, http.StatusInternalServerError, "gagal memuat akun")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.PasswordLama)) != nil {
		fail(w, http.StatusBadRequest, "kata sandi lama tidak cocok")
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.PasswordBaru), bcrypt.DefaultCost)
	if err != nil {
		fail(w, http.StatusInternalServerError, "gagal memproses kata sandi")
		return
	}
	if _, err := a.db.Exec(`UPDATE users SET password_hash=$1 WHERE id=$2`, string(newHash), u.ID); err != nil {
		fail(w, http.StatusInternalServerError, "gagal menyimpan kata sandi")
		return
	}
	a.audit(r, u.ID, "kata_sandi.diubah", "user="+u.Email)
	writeJSON(w, http.StatusOK, Envelope{"pesan": "kata sandi berhasil diubah"})
}

func isDigits(s string, n int) bool {
	if len(s) != n {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
