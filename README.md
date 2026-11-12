# Sistem Alih Media Sertipikat Analog ke Elektronik (Prototipe)

Aplikasi web untuk mensimulasikan alih media sertipikat tanah analog menjadi **draf sertipikat elektronik**: pengajuan oleh masyarakat, serah terima sertipikat asli di loket, input data analog, pencatatan PNBP, validasi, sampai terbitnya draf PDF dengan QR verifikasi dan jejak audit.

> **SIMULASI.** Seluruh data bersifat fiktif. Prototipe ini tidak memakai tanda tangan elektronik tersertifikasi BSrE, tidak terhubung ke sistem resmi ATR/BPN, dan dokumen yang dihasilkan bukan sertipikat elektronik resmi serta tidak memiliki akibat hukum.

## Daftar isi

- [Fitur per peran](#fitur-per-peran)
- [Teknologi](#teknologi)
- [Struktur repositori](#struktur-repositori)
- [Menjalankan dengan Docker Compose](#menjalankan-dengan-docker-compose)
- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Akun demo](#akun-demo)
- [Alur demo](#alur-demo)
- [API](#api)
- [Model data](#model-data)
- [Keamanan dan pelindungan data pribadi](#keamanan-dan-pelindungan-data-pribadi)
- [Pemetaan kebutuhan PRD](#pemetaan-kebutuhan-prd)
- [Pengujian](#pengujian)
- [Batasan dan pengembangan lanjutan](#batasan-dan-pengembangan-lanjutan)

## Fitur per peran

| Peran | Fitur |
| --- | --- |
| **Masyarakat** | Registrasi & login, ajukan alih media, unggah KTP/KK/foto sertipikat/surat kuasa/akta pendirian, pantau status & kekurangan berkas, lihat PNBP, kirim perbaikan, unduh draf sertipikat elektronik |
| **Petugas Loket** | Antrean permohonan, catat serah terima sertipikat asli + berita acara & warkah, unggah scan sertipikat, input data analog, catat PNBP, ajukan ke validasi |
| **Petugas Verifikasi** | Antrean validasi, layar bandingkan scan vs data input, daftar periksa kelengkapan, keputusan setujui/tolak/perlu perbaikan dengan catatan, penerbitan draf sertipikat elektronik |
| **Admin** | Kelola pengguna & peran (tambah, ubah peran, nonaktifkan), dasbor ringkas, log audit append-only |
| **Publik** | Cek keaslian dengan kode atau pindai QR (BarcodeDetector), data pribadi tersamar |

Pemisahan tugas diterapkan: petugas yang mengajukan permohonan ke validasi tidak dapat memberi keputusan atas permohonan yang sama.

## Teknologi

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router, Lucide
- **Backend:** Go 1.22, REST/JSON, JWT (HS256), bcrypt, PostgreSQL (`lib/pq`)
- **Dokumen:** generator PDF dan QR ditulis sendiri di Go (tanpa pustaka eksternal), hash SHA-256
- **Berkas:** disk lokal, nama acak, validasi tipe/ukuran, checksum SHA-256
- **Penyebaran:** Docker Compose (PostgreSQL + API + Nginx)

Modul Go di-*vendor* (`backend/vendor/`) sehingga build backend tidak memerlukan unduhan paket.

## Struktur repositori

```
.
├── backend/                  API Go
│   ├── main.go               entry point, konfigurasi, routing
│   ├── migrations/           migrasi skema berversi (embedded)
│   ├── handlers_*.go         endpoint per modul
│   ├── qr.go                 encoder QR (level M, versi 1–10)
│   ├── pdf.go                generator PDF draf sertipikat
│   ├── seed.go               data demo (akun + 5 permohonan)
│   ├── vendor/               dependensi Go
│   └── Dockerfile
├── frontend/                 aplikasi React
│   ├── src/pages/            halaman per peran + verifikasi publik
│   ├── src/components/       layout, komponen UI
│   └── Dockerfile, nginx.conf
├── docker-compose.yml
├── .env.example
└── PRD – Sistem Alih Media ....md
```

## Menjalankan dengan Docker Compose

Prasyarat: Docker Desktop/engine aktif.

```bash
cp .env.example .env      # Windows: copy .env.example .env
docker compose up --build
```

Buka <http://localhost:8080>. Basis data, migrasi, dan data demo disiapkan otomatis pada start pertama.

Ganti `JWT_SECRET` dan `POSTGRES_PASSWORD` di `.env` untuk pemakaian bersama. Hentikan dengan `docker compose down`; tambahkan `-v` bila ingin menghapus data demo.

## Menjalankan secara lokal

### 1. PostgreSQL

Buat basis data `alihmedia` (contoh dengan Docker):

```bash
docker run --name alihmedia-db -e POSTGRES_USER=alihmedia -e POSTGRES_PASSWORD=alihmedia \
  -e POSTGRES_DB=alihmedia -p 5432:5432 -d postgres:16-alpine
```

### 2. Backend (port 8080)

```bash
cd backend
# Windows PowerShell
$env:DATABASE_URL="postgres://alihmedia:alihmedia@localhost:5432/alihmedia?sslmode=disable"
$env:JWT_SECRET="rahasia-lokal"
$env:PUBLIC_BASE_URL="http://localhost:5173"
$env:STORAGE_DIR="./storage"
go run -mod=vendor .
```

Seed demo berjalan otomatis bila tabel `users` masih kosong. Migrasi diterapkan otomatis saat start.

Variabel lingkungan:

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `8080` | Port API |
| `DATABASE_URL` | `postgres://alihmedia:alihmedia@localhost:5432/alihmedia?sslmode=disable` | DSN PostgreSQL |
| `JWT_SECRET` | `dev-secret-change-me` | Rahasia penandatangan JWT |
| `STORAGE_DIR` | `./storage` | Folder berkas unggahan |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Basis URL pada QR (harus mengarah ke frontend) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin frontend yang diizinkan |
| `MAX_UPLOAD_MB` | `10` | Batas ukuran unggahan |

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Vite mem-proxy `/api` ke `http://localhost:8080`. Buka <http://localhost:5173>.

## Akun demo

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Masyarakat | `masyarakat@demo.test` | `Masyarakat123!` |
| Petugas Loket | `loket@demo.test` | `Loket123!` |
| Petugas Verifikasi | `verifikasi@demo.test` | `Verifikasi123!` |
| Admin | `admin@demo.test` | `Admin123!` |

Halaman login menyediakan tombol isi otomatis untuk tiap akun.

Data demo berisi 5 permohonan dengan status berbeda: Diajukan, Berkas diterima, Menunggu validasi, Perlu perbaikan, Ditolak, dan Terbit (simulasi). Berkas contoh berupa gambar placeholder.

## Alur demo

1. **Masyarakat** masuk, buat permohonan baru, unggah KTP, KK, dan foto sertipikat pada halaman detail.
2. **Loket** membuka Antrean Loket → catat serah terima (centang KTP/KK cocok), simpan data sertipikat analog, unggah scan sertipikat asli, catat PNBP lunas, lalu ajukan ke validasi.
3. **Verifikasi** membuka permohonan berstatus Menunggu validasi → bandingkan scan dan data, periksa daftar periksa, lalu Setujui dengan catatan.
4. Draf sertipikat elektronik terbit otomatis. **Masyarakat** mengunduh PDF; QR pada PDF mengarah ke halaman **Cek Keaslian** dengan data tersamar.
5. **Admin** memeriksa dasbor, pengguna, dan log audit.

Jika memilih **Perlu perbaikan**, permohonan kembali ke masyarakat untuk unggah ulang berkas dan mengirim catatan perbaikan. **Tolak** mengakhiri permohonan.

## API

Autentikasi memakai `Authorization: Bearer <token>`.

| Metode | Endpoint | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | publik | Login, dibatasi 10 percobaan/5 menit per IP |
| POST | `/api/auth/register` | publik | Registrasi masyarakat |
| GET | `/api/auth/me` | semua | Profil akun |
| POST | `/api/auth/change-password` | semua | Ubah kata sandi |
| GET | `/api/permohonan` | semua | Daftar (masyarakat: milik sendiri); filter `status`, `q`, paginasi |
| POST | `/api/permohonan` | masyarakat | Buat permohonan |
| GET | `/api/permohonan/{id}` | sesuai akses | Detail lengkap + kelengkapan + riwayat |
| POST | `/api/permohonan/{id}/dokumen` | masyarakat/loket/verifikasi | Unggah berkas (multipart: `jenis`, `file`) |
| GET | `/api/dokumen/{id}` | sesuai akses | Pratinjau/unduh berkas |
| POST | `/api/permohonan/{id}/serah-terima` | loket | Serah terima sertipikat asli & warkah |
| PUT | `/api/permohonan/{id}/sertipikat-analog` | loket | Input/ubah data analog |
| POST | `/api/permohonan/{id}/pnbp` | loket | Catat status PNBP (simulasi) |
| POST | `/api/permohonan/{id}/ajukan-validasi` | loket | Kirim ke antrean validasi |
| POST | `/api/permohonan/{id}/keputusan` | verifikasi | `setujui` / `perbaikan` / `tolak` + catatan |
| POST | `/api/permohonan/{id}/kirim-perbaikan` | masyarakat | Kirim perbaikan setelah berkas diunggah |
| GET | `/api/permohonan/{id}/sertipikat-elektronik.pdf` | sesuai akses | Unduh draf PDF |
| GET | `/api/verifikasi/{kode}` | publik | Cek keaslian, data tersamar, dibatasi 30/menit per IP |
| GET/POST/PUT | `/api/users`, `/api/users/{id}` | admin | Kelola pengguna & peran |
| GET | `/api/audit` | admin | Log audit (append-only) |
| GET | `/api/dashboard` | admin/loket/verifikasi | Statistik ringkas |

## Model data

Delapan tabel utama: `users`, `permohonan`, `sertipikat_analog`, `dokumen`, `pnbp`, `sertipikat_elektronik`, `riwayat_status`, `audit_log`.

- Status permohonan: **Diajukan → Berkas diterima → Menunggu validasi → Terbit (simulasi)**, dengan cabang **Perlu perbaikan** dan **Ditolak**.
- Setiap perpindahan status dicatat di `riwayat_status` (tidak menimpa data lama).
- `audit_log` dilindungi trigger PostgreSQL yang menolak `UPDATE` dan `DELETE`.
- Berkas unggahan disimpan di luar folder web dengan nama acak dan checksum SHA-256.
- Draf sertipikat elektronik memuat nomor, edisi, kode verifikasi, hash SHA-256, QR, dan penanda SIMULASI.

## Keamanan dan pelindungan data pribadi

- Kata sandi di-hash dengan bcrypt; JWT berumur 2 jam; peran diperiksa di setiap endpoint, bukan hanya di tampilan.
- Pemisahan tugas input vs validasi ditegakkan di server.
- Validasi tipe isi berkas (JPG/PNG/PDF), batas ukuran, nama acak, checksum SHA-256.
- Halaman publik menyamarkan NIK dan nama pemegang hak; hanya data ringkas yang ditampilkan.
- Rate limit pada login, registrasi, dan cek keaslian publik.
- CORS dibatasi; rahasia lewat variabel lingkungan; header keamanan dasar di Nginx.
- Semua data adalah fiktif; jangan memasukkan data pertanahan atau data pribadi sebenarnya.

## Pemetaan kebutuhan PRD

| Kode | Status | Catatan |
| --- | --- | --- |
| F-01 Autentikasi JWT & peran | Selesai | Middleware peran di semua endpoint |
| F-02 Registrasi & ubah kata sandi | Selesai | — |
| F-03 Form pengajuan & unggah syarat | Selesai | KTP, KK, foto, surat kuasa, akta pendirian |
| F-04 Daftar/detail permohonan sendiri | Selesai | Status, riwayat, kekurangan berkas |
| F-05 Antrean & serah terima loket | Selesai | Berita acara & warkah |
| F-06 Unggah scan & pratinjau | Selesai | Pratinjau gambar/PDF di aplikasi |
| F-07 Input data sertipikat analog | Selesai | — |
| F-08 PNBP simulasi | Selesai | Loket mencatat, pemohon melihat |
| F-09 Layar validasi berdampingan | Selesai | Scan vs data + daftar periksa |
| F-10 Keputusan + catatan wajib | Selesai | Setujui/tolak/perbaikan |
| F-11 Terbit draf PDF + QR + SIMULASI | Selesai | PDF & QR dibuat di Go |
| F-12 Pemohon unduh draf | Selesai | — |
| F-13 Warkah & berita acara | Selesai | Tercatat pada data analog + checksum scan |
| F-14 Cek keaslian publik | Selesai | Kode atau pindai QR, data tersamar |
| F-15 Kelola pengguna & peran | Selesai | Tambah, ubah peran, nonaktifkan |
| F-16 Dasbor admin | Selesai | Jumlah per status, rata-rata proses |
| F-17 Log audit | Selesai | Append-only dengan trigger DB |
| F-18 Notifikasi dalam aplikasi | Tidak dikerjakan (P2) | Status terlihat di dasbor/detail |
| F-19 BSrE & integrasi ATR/BPN | Di luar lingkup | Diganti hash + QR simulasi |
| F-20 OCR | Di luar lingkup | Pengembangan lanjutan |

## Pengujian

```bash
# Backend: unit test QR & PDF, vet
cd backend
go test -mod=vendor ./...
go vet -mod=vendor ./...

# Frontend: typecheck & build produksi
cd frontend
npm run typecheck
npm run build
```

QR diuji dengan decoder independen (jsQR) untuk berbagai versi dan payload; PDF dirender dengan PDF.js. Uji alur API end-to-end mencakup login empat peran, pengajuan, unggah berkas, serah terima, PNBP, validasi, penerbitan, verifikasi publik, RBAC, dan penolakan keputusan ganda.

## Batasan dan pengembangan lanjutan

- Tanda tangan elektronik hanya simulasi; penerbitan resmi memerlukan BSrE dan sistem ATR/BPN.
- Belum ada notifikasi push/email, OCR, peta bidang, atau pembayaran PNBP nyata.
- Penyimpanan berkas di disk lokal; dapat dipindah ke object storage (MinIO/S3).
- Untuk produksi: aktifkan HTTPS, ganti rahasia, batasi akses jaringan, dan jadwalkan pencadangan basis data.
