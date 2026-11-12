package main

import (
	"log"
	"net/http"
	"os"
	"time"
	
)

func main() {
	cfg := loadConfig()
	if err := os.MkdirAll(cfg.StorageDir, 0o750); err != nil {
		log.Fatalf("gagal menyiapkan folder penyimpanan: %v", err)
	}

	db, err := openDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("gagal terhubung ke basis data: %v", err)
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		log.Fatalf("gagal menjalankan migrasi: %v", err)
	}
	if err := seedDemo(db, cfg); err != nil {
		log.Fatalf("gagal menyiapkan data demo: %v", err)
	}

	app := &App{cfg: cfg, db: db, limiter: newRateLimiter()}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           logRequests(cors(cfg.CORSOrigin, app.routes())),
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("API alih media (SIMULASI) berjalan di http://localhost:%s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
