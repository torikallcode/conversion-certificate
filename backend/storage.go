package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var allowedUploads = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".pdf":  "application/pdf",
}

var allowedJenisDokumen = map[string]bool{
	"ktp":             true,
	"kk":              true,
	"surat_kuasa":     true,
	"akta_pendirian":  true,
	"foto_sertipikat": true,
	"scan_sertipikat": true,
	"lainnya":         true,
}

type savedFile struct {
	RelPath  string
	Mime     string
	Size     int64
	Checksum string
	NamaAsli string
}

func randomName(ext string) string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d%s", os.Getpid(), ext)
	}
	return hex.EncodeToString(buf) + ext
}

func (a *App) saveUpload(permohonanID int64, fh *multipart.FileHeader) (*savedFile, error) {
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	mimeType, ok := allowedUploads[ext]
	if !ok {
		return nil, fmt.Errorf("tipe berkas tidak diizinkan (hanya JPG, PNG, atau PDF)")
	}
	if fh.Size <= 0 || fh.Size > a.cfg.MaxUploadMB*1024*1024 {
		return nil, fmt.Errorf("ukuran berkas melebihi batas %d MB", a.cfg.MaxUploadMB)
	}

	src, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	sniffed := http.DetectContentType(head[:n])
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	if !strings.HasPrefix(sniffed, "image/") && sniffed != "application/pdf" {
		return nil, fmt.Errorf("isi berkas tidak sesuai dengan tipe yang diizinkan")
	}
	if mimeType == "application/pdf" && sniffed != "application/pdf" {
		return nil, fmt.Errorf("berkas bukan PDF yang valid")
	}

	dir := filepath.Join(a.cfg.StorageDir, "permohonan", fmt.Sprintf("%d", permohonanID))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	name := randomName(ext)
	full := filepath.Join(dir, name)
	dst, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return nil, err
	}
	hasher := sha256.New()
	size, copyErr := io.Copy(io.MultiWriter(dst, hasher), src)
	closeErr := dst.Close()
	if copyErr != nil {
		os.Remove(full)
		return nil, copyErr
	}
	if closeErr != nil {
		os.Remove(full)
		return nil, closeErr
	}

	return &savedFile{
		RelPath:  filepath.ToSlash(filepath.Join("permohonan", fmt.Sprintf("%d", permohonanID), name)),
		Mime:     mimeType,
		Size:     size,
		Checksum: hex.EncodeToString(hasher.Sum(nil)),
		NamaAsli: filepath.Base(fh.Filename),
	}, nil
}

func (a *App) absolutePath(rel string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(rel))
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("path berkas tidak valid")
	}
	return filepath.Join(a.cfg.StorageDir, clean), nil
}

func (a *App) removeFile(rel string) {
	if full, err := a.absolutePath(rel); err == nil {
		os.Remove(full)
	}
}
