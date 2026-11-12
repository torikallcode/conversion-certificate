package main

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	StorageDir    string
	PublicBaseURL string
	MaxUploadMB   int64
	CORSOrigin    string
	TokenTTL      time.Duration
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadConfig() Config {
	maxMB := int64(10)
	if v := os.Getenv("MAX_UPLOAD_MB"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			maxMB = n
		}
	}
	return Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://alihmedia:alihmedia@localhost:5432/alihmedia?sslmode=disable"),
		JWTSecret:     env("JWT_SECRET", "dev-secret-change-me"),
		StorageDir:    env("STORAGE_DIR", "./storage"),
		PublicBaseURL: env("PUBLIC_BASE_URL", "http://localhost:5173"),
		MaxUploadMB:   maxMB,
		CORSOrigin:    env("CORS_ORIGIN", "http://localhost:5173"),
		TokenTTL:      2 * time.Hour,
	}
}
