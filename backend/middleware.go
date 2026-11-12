package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

type Envelope map[string]any

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("gagal menulis respons: %v", err)
	}
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, Envelope{"error": msg})
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 2<<20))
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func (a *App) requireAuth(roles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				fail(w, http.StatusUnauthorized, "token tidak ditemukan")
				return
			}
			claims, err := a.parseToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
			if err != nil {
				fail(w, http.StatusUnauthorized, "token tidak valid atau kedaluwarsa")
				return
			}
			u, err := a.loadUser(claims.UserID)
			if err != nil || !u.Aktif {
				fail(w, http.StatusUnauthorized, "akun tidak aktif")
				return
			}
			if len(roles) > 0 {
				allowed := false
				for _, role := range roles {
					if u.Role == role {
						allowed = true
						break
					}
				}
				if !allowed {
					fail(w, http.StatusForbidden, "peran Anda tidak memiliki akses ke aksi ini")
					return
				}
			}
			ctx := context.WithValue(r.Context(), ctxUserKey{}, u)
			next(w, r.WithContext(ctx))
		}
	}
}

func currentUser(r *http.Request) *User {
	u, _ := r.Context().Value(ctxUserKey{}).(*User)
	return u
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if !strings.HasPrefix(r.URL.Path, "/api/healthz") {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if o := r.Header.Get("Origin"); o != "" && (origin == "*" || o == origin) {
			w.Header().Set("Access-Control-Allow-Origin", o)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type rateLimiter struct {
	entries map[string]*limitEntry
}

type limitEntry struct {
	count   int
	resetAt time.Time
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{entries: make(map[string]*limitEntry)}
}

func (l *rateLimiter) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	for k, e := range l.entries {
		if now.After(e.resetAt) {
			delete(l.entries, k)
		}
	}
	e, ok := l.entries[key]
	if !ok || now.After(e.resetAt) {
		l.entries[key] = &limitEntry{count: 1, resetAt: now.Add(window)}
		return true
	}
	e.count++
	return e.count <= limit
}
