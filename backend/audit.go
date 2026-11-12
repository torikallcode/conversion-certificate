package main

import (
	"database/sql"
	"log"
	"net/http"
)

func (a *App) audit(r *http.Request, userID int64, aksi, objek string) {
	var uid any
	if userID > 0 {
		uid = userID
	}
	_, err := a.db.Exec(
		`INSERT INTO audit_log (user_id, aksi, objek, ip) VALUES ($1, $2, $3, $4)`,
		uid, aksi, objek, clientIP(r),
	)
	if err != nil {
		log.Printf("gagal menulis audit log: %v", err)
	}
}

func (a *App) recordRiwayat(tx *sql.Tx, permohonanID int64, dari, ke string, userID int64, catatan string) error {
	_, err := tx.Exec(
		`INSERT INTO riwayat_status (permohonan_id, dari_status, ke_status, oleh_user_id, catatan)
		 VALUES ($1, $2, $3, $4, $5)`,
		permohonanID, dari, ke, userID, catatan,
	)
	return err
}
