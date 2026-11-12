package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestQRMatrixSizes(t *testing.T) {
	cases := []string{
		"A",
		"http://localhost:5173/verifikasi/ABCD2345WXYZ",
		"https://alihmedia.example.go.id/verifikasi/SE-000123-2026",
	}
	for _, payload := range cases {
		matrix, err := qrMatrix([]byte(payload))
		if err != nil {
			t.Fatalf("payload %q: %v", payload, err)
		}
		size := len(matrix)
		if size < 21 || size > 57 || (size-17)%4 != 0 {
			t.Errorf("payload %q: ukuran tidak valid %d", payload, size)
		}
		for i := 0; i < size; i++ {
			if len(matrix[i]) != size {
				t.Fatalf("matriks tidak persegi pada baris %d", i)
			}
		}
	}
}

func TestQRPNGOutput(t *testing.T) {
	dir := os.Getenv("QR_OUT_DIR")
	payloads := []string{
		"http://localhost:5173/verifikasi/ABCD2345WXYZ",
		"https://alihmedia.example.go.id/verifikasi/SE-000123-2026",
		"SIMULASI",
		strings.Repeat("a", 170),
		strings.Repeat("b", 210),
	}
	for i, payload := range payloads {
		png, err := qrEncodePNG(payload, 8)
		if err != nil {
			t.Fatalf("payload %q: %v", payload, err)
		}
		if len(png) == 0 {
			t.Fatalf("payload %q: PNG kosong", payload)
		}
		if dir != "" {
			path := filepath.Join(dir, "qr-"+string(rune('0'+i))+".png")
			if err := os.WriteFile(path, png, 0o644); err != nil {
				t.Fatal(err)
			}
		}
	}
}
