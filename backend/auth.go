package main

import (
	"database/sql"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	ID         int64     `json:"id"`
	Nama       string    `json:"nama"`
	Email      string    `json:"email"`
	Role       string    `json:"role"`
	Aktif      bool      `json:"aktif"`
	NIK        string    `json:"nik,omitempty"`
	NoHP       string    `json:"no_hp,omitempty"`
	DibuatPada time.Time `json:"dibuat_pada"`
}

type ctxUserKey struct{}

type Claims struct {
	UserID int64  `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func (a *App) issueToken(u *User) (string, error) {
	claims := Claims{
		UserID: u.ID,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.Email,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(a.cfg.TokenTTL)),
			Issuer:    "alihmedia-simulasi",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString([]byte(a.cfg.JWTSecret))
}

func (a *App) parseToken(raw string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(a.cfg.JWTSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func (a *App) loadUser(id int64) (*User, error) {
	u := &User{}
	err := a.db.QueryRow(`SELECT id, nama, email, role, aktif, nik, no_hp, dibuat_pada FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.Nama, &u.Email, &u.Role, &u.Aktif, &u.NIK, &u.NoHP, &u.DibuatPada)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (a *App) loadUserByEmail(email string) (*User, string, error) {
	u := &User{}
	var hash string
	err := a.db.QueryRow(`SELECT id, nama, email, role, aktif, nik, no_hp, dibuat_pada, password_hash FROM users WHERE lower(email)=lower($1)`, strings.TrimSpace(email)).
		Scan(&u.ID, &u.Nama, &u.Email, &u.Role, &u.Aktif, &u.NIK, &u.NoHP, &u.DibuatPada, &hash)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, "", nil
		}
		return nil, "", err
	}
	return u, hash, nil
}
