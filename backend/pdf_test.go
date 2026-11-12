package main

import (
	"os"
	"testing"
	"time"
)

func TestSertipikatPDF(t *testing.T) {
	out := os.Getenv("PDF_OUT")
	if out == "" {
		t.Skip("PDF_OUT tidak diatur")
	}
	luas := 245.5
	tahun := 2012
	p := &Permohonan{
		ID: 2, NomorTiket: "AM-20261101-0915", JenisPemohon: "perorangan",
		NamaPemohon: "Siti Rahmawati",
	}
	sa := &SertipikatAnalog{
		JenisHak: "Hak Milik", NomorHak: "05678/Cibadak", PemegangHak: "Siti Rahmawati",
		LuasM2: &luas, Lokasi: "Desa Cibadak, Kec. Cibadak, Kab. Sukabumi", TahunTerbit: &tahun,
	}
	cert := &SertipikatElektronik{
		Nomor: "SE-000002/2026", Edisi: "1", KodeVerifikasi: "ABCD2345WXYZ",
		HashDokumen:   "8f1d9b0c2a7e4f6d3b8c5a1e9f0d7c4b2a6e8f1d3c5b7a9e0f2d4c6b8a1e3f5d",
		TanggalTerbit: time.Now(), Simulasi: true,
	}
	pemohon := &User{ID: 4, Nama: "Siti Rahmawati"}
	pdf, err := buildSertipikatPDF(loadConfig(), p, sa, cert, pemohon)
	if err != nil {
		t.Fatal(err)
	}
	if len(pdf) < 1000 || string(pdf[:5]) != "%PDF-" {
		t.Fatalf("PDF tidak valid, ukuran %d", len(pdf))
	}
	if err := os.WriteFile(out, pdf, 0o644); err != nil {
		t.Fatal(err)
	}
}
