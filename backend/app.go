package main

import (
	"database/sql"
	"net/http"
)

type App struct {
	cfg     Config
	db      *sql.DB
	limiter *rateLimiter
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := a.db.Ping(); err != nil {
			fail(w, http.StatusServiceUnavailable, "basis data tidak tersedia")
			return
		}
		writeJSON(w, http.StatusOK, Envelope{"status": "ok", "simulasi": true})
	})

	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/register", a.register)
	mux.HandleFunc("GET /api/auth/me", a.requireAuth()(a.me))
	mux.HandleFunc("POST /api/auth/change-password", a.requireAuth()(a.changePassword))

	mux.HandleFunc("GET /api/permohonan", a.requireAuth()(a.listPermohonan))
	mux.HandleFunc("POST /api/permohonan", a.requireAuth("masyarakat")(a.createPermohonan))
	mux.HandleFunc("GET /api/permohonan/{id}", a.requireAuth()(a.getPermohonanDetail))
	mux.HandleFunc("POST /api/permohonan/{id}/dokumen", a.requireAuth("masyarakat", "loket", "verifikasi")(a.uploadDokumen))
	mux.HandleFunc("GET /api/dokumen/{id}", a.requireAuth()(a.downloadDokumen))

	mux.HandleFunc("POST /api/permohonan/{id}/serah-terima", a.requireAuth("loket")(a.serahTerima))
	mux.HandleFunc("PUT /api/permohonan/{id}/sertipikat-analog", a.requireAuth("loket")(a.updateSertipikatAnalog))
	mux.HandleFunc("POST /api/permohonan/{id}/pnbp", a.requireAuth("loket")(a.catatPNBP))
	mux.HandleFunc("POST /api/permohonan/{id}/ajukan-validasi", a.requireAuth("loket")(a.ajukanValidasi))

	mux.HandleFunc("POST /api/permohonan/{id}/keputusan", a.requireAuth("verifikasi")(a.keputusan))
	mux.HandleFunc("POST /api/permohonan/{id}/kirim-perbaikan", a.requireAuth("masyarakat")(a.kirimPerbaikan))
	mux.HandleFunc("GET /api/permohonan/{id}/sertipikat-elektronik.pdf", a.requireAuth()(a.cetakSertipikat))

	mux.HandleFunc("GET /api/verifikasi/{kode}", a.verifikasiPublik)

	mux.HandleFunc("GET /api/users", a.requireAuth("admin")(a.listUsers))
	mux.HandleFunc("POST /api/users", a.requireAuth("admin")(a.createUser))
	mux.HandleFunc("PUT /api/users/{id}", a.requireAuth("admin")(a.updateUser))
	mux.HandleFunc("GET /api/audit", a.requireAuth("admin")(a.listAudit))
	mux.HandleFunc("GET /api/dashboard", a.requireAuth("admin", "loket", "verifikasi")(a.dashboard))

	return mux
}
