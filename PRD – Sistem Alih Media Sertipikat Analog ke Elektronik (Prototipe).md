# PRD – Sistem Alih Media Sertipikat Analog ke Elektronik (Prototipe)

Nov 11, 2026 · @Albar

## 1. Ringkasan & latar belakang

Sistem ini adalah aplikasi web yang membantu kantor pertanahan memproses **alih media sertipikat tanah analog (buku fisik) menjadi sertipikat elektronik**, dari pengajuan oleh pemohon sampai terbitnya sertipikat elektronik, dengan status yang bisa dilacak.

Menurut pemberitaan, alih media dilakukan dengan membawa sertipikat asli ke kantor pertanahan; sertipikat analog yang diserahkan menjadi bagian dari warkah, dan pemohon menerima sertipikat elektronik yang dapat diakses lewat aplikasi Sentuh Tanahku ([detikProperti](https://www.detik.com/properti/tips-dan-panduan/d-7942184/ubah-sertifikat-tanah-jadi-elektronik-diminta-sertifikat-asli-kenapa), [CNN Indonesia](https://www.cnnindonesia.com/nasional/20250619143222-20-1241494/sertifikat-tanah-digital-sudah-berlaku-ini-perbedaan-dengan-yang-lama)).

Masalah yang ingin diatasi (asumsi, perlu dikonfirmasi pembimbing): pemohon tidak tahu kelengkapan berkas dan posisi permohonannya, petugas memeriksa berkas secara manual, dan antrean sulit dipantau.

Penerbitan sertipikat elektronik yang sah memakai tanda tangan elektronik tersertifikasi BSrE dan sistem resmi ATR/BPN. Prototipe ini **mensimulasikan** alur tersebut dengan data fiktif dan menandai hasilnya sebagai "draf simulasi"; integrasi ke sistem resmi ada di luar lingkup (bagian 4).

## 2. Tujuan & metrik keberhasilan

Tujuan prototipe: mendemonstrasikan alur alih media dari pengajuan sampai draf sertipikat elektronik terbit, dengan peran, pembayaran, dan jejak audit yang jelas.

| Tujuan | Indikator keberhasilan prototipe |
| --- | --- |
| Mempermudah pengajuan | Pemohon mengajukan dan mengunggah persyaratan (KTP, KK, foto sertipikat, surat kuasa bila ada) lewat web |
| Mempercepat pemeriksaan | Petugas memeriksa kelengkapan dan kecocokan data dalam satu layar |
| Transparansi bagi pemohon | Pemohon melihat status, kekurangan berkas, dan status PNBP kapan saja |
| Akuntabilitas | Setiap perubahan status tercatat (siapa, kapan, apa) |
| Hasil elektronik | Setiap permohonan yang disetujui menghasilkan draf sertipikat elektronik (PDF dengan QR verifikasi) |

Target angka (waktu proses, jumlah permohonan per hari) belum ditetapkan; lihat pertanyaan terbuka di bagian 11.

## 3. Pengguna & peran

Empat peran dengan hak akses terpisah (RBAC); setiap akun hanya memegang satu peran.

| Peran | Tugas utama | Hak akses |
| --- | --- | --- |
| Masyarakat | Mengajukan alih media, mengunggah persyaratan, melihat status dan PNBP, mengunduh draf sertipikat elektronik | Hanya data permohonannya sendiri |
| Petugas Loket | Menerima sertipikat asli dan memeriksa kelengkapan berkas, mencatat serah terima, menginput data sertipikat analog, mencatat status PNBP | Semua permohonan di kantornya; tidak bisa menyetujui |
| Petugas Verifikasi | Memvalidasi kecocokan data dengan buku tanah/warkah; menyetujui, menolak, atau meminta perbaikan; memicu penerbitan draf sertipikat elektronik | Keputusan atas permohonan; tidak bisa mengubah data tanpa jejak |
| Admin | Mengelola akun dan peran, melihat dasbor dan log audit, mengatur master data | Seluruh sistem; tidak ikut memvalidasi |

Pemisahan tugas: petugas yang menginput data tidak boleh menjadi petugas yang memvalidasinya. Apakah penerbit sertipikat elektronik adalah pejabat tersendiri menjadi pertanyaan terbuka.

## 4. Ruang lingkup

Prototipe mensimulasikan seluruh alur alih media; hal yang butuh kewenangan atau sistem resmi ATR/BPN dikeluarkan.

**Termasuk (in scope)**

- Login dan peran pengguna (Masyarakat, Loket, Verifikasi, Admin)
- Pengajuan alih media oleh masyarakat dan unggah persyaratan: KTP, KK, foto sertipikat, surat kuasa bila dikuasakan, akta pendirian bagi badan hukum
- Pencatatan serah terima sertipikat asli di loket (asumsi: pemohon tetap membawa sertipikat asli ke kantor)
- Input data sertipikat analog dan unggah scan oleh petugas loket
- Pencatatan tagihan dan status PNBP (simulasi, tanpa pembayaran nyata)
- Validasi data dan keputusan (setujui, tolak, minta perbaikan) dengan catatan
- Penerbitan draf sertipikat elektronik: PDF dengan nomor, edisi, QR verifikasi, dan penanda "SIMULASI"
- Pencatatan sertipikat analog yang diserahkan sebagai bagian dari warkah
- Cek keaslian lewat kode/QR, log audit, dan dasbor ringkas

**Tidak termasuk (out of scope)**

- Tanda tangan elektronik tersertifikasi BSrE yang sebenarnya dan penerbitan sertipikat elektronik yang sah
- Integrasi dengan sistem resmi ATR/BPN (mis. Sentuh Tanahku, KKP) dan data spasial/peta bidang
- Pembayaran PNBP nyata dan penegasan batas bidang di lapangan
- OCR otomatis (pengembangan lanjutan)
- Data pertanahan asli; prototipe hanya memakai data contoh

## 5. Alur proses

&#91;embedded content: alur permohonan · 3 peran, 3 hasil keputusan\]

Pemohon mengajukan dan mengunggah persyaratan, lalu menyerahkan sertipikat asli ke loket. Loket memeriksa kelengkapan, menginput data sertipikat analog, dan mencatat PNBP; Verifikasi memvalidasi kecocokan data. Hanya keputusan "setujui" yang menerbitkan draf sertipikat elektronik; "perlu perbaikan" mengembalikan berkas ke pemohon dan "tolak" mengakhiri permohonan. Setiap perpindahan status tercatat di riwayat dan log audit.

## 6. Kebutuhan fungsional

Prioritas: **P0** wajib untuk demo, **P1** sebaiknya ada, **P2** pengembangan lanjutan.

| Kode | Modul | Kebutuhan | Peran | Prioritas |
| --- | --- | --- | --- | --- |
| F-01 | Autentikasi | Login/logout dengan JWT; peran membatasi menu dan endpoint | Semua | P0 |
| F-02 | Autentikasi | Registrasi akun masyarakat dan ubah kata sandi | Masyarakat | P1 |
| F-03 | Pengajuan | Form alih media (data pemohon, jenis dan nomor hak, lokasi) dan unggah persyaratan: KTP, KK, foto sertipikat, surat kuasa bila dikuasakan, akta pendirian bagi badan hukum | Masyarakat | P0 |
| F-04 | Pengajuan | Daftar dan detail permohonan sendiri dengan status, riwayat, dan kekurangan berkas | Masyarakat | P0 |
| F-05 | Loket | Antrean permohonan; catat serah terima sertipikat asli dan pencocokan KTP/KK | Loket | P0 |
| F-06 | Loket | Unggah scan sertipikat asli dan pratinjau | Loket | P0 |
| F-07 | Loket | Input data sertipikat analog: jenis dan nomor hak, pemegang hak, luas, lokasi, tahun terbit | Loket | P0 |
| F-08 | PNBP | Catat tagihan dan status bayar (simulasi, tanpa pembayaran nyata) | Loket, Masyarakat | P1 |
| F-09 | Validasi | Layar validasi: scan berdampingan dengan data input dan daftar periksa kelengkapan | Verifikasi | P0 |
| F-10 | Validasi | Setujui, tolak, atau minta perbaikan, wajib dengan catatan | Verifikasi | P0 |
| F-11 | Penerbitan | Setelah disetujui, sistem membuat draf sertipikat elektronik: PDF dengan nomor, edisi, QR verifikasi, dan penanda SIMULASI | Sistem | P0 |
| F-12 | Penerbitan | Pemohon melihat dan mengunduh draf sertipikat elektronik miliknya | Masyarakat | P1 |
| F-13 | Warkah | Catat sertipikat analog yang diserahkan sebagai bagian dari warkah beserta berita acara serah terima | Loket | P1 |
| F-14 | Publik | Halaman cek keaslian: masukkan kode atau pindai QR, tampilkan data ringkas tersamar | Publik | P1 |
| F-15 | Admin | Kelola pengguna dan peran (tambah, nonaktifkan, ubah peran) | Admin | P0 |
| F-16 | Admin | Dasbor: jumlah permohonan per status, rata-rata waktu proses | Admin | P1 |
| F-17 | Audit | Log aktivitas tidak bisa diubah: login, perubahan status, unduhan berkas | Admin | P0 |
| F-18 | Notifikasi | Pemberitahuan perubahan status di dalam aplikasi | Masyarakat | P2 |
| F-19 | Integrasi | Tanda tangan elektronik BSrE dan sinkronisasi dengan sistem resmi ATR/BPN | Sistem | P2 (di luar prototipe) |
| F-20 | OCR | Ekstraksi otomatis data dari scan untuk membantu input | Loket | P2 |

## 7. Non-fungsional, keamanan & data pribadi

Data sertipikat memuat data pribadi dan aset bernilai tinggi, jadi keamanan menjadi syarat utama sejak prototipe, bukan tambahan di akhir.

- **Autentikasi & otorisasi:** JWT berumur pendek, kata sandi di-hash dengan bcrypt/argon2, pemeriksaan peran di setiap endpoint (bukan hanya di tampilan).
- **Pelindungan data pribadi:** mengacu pada UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi; kumpulkan data seperlunya, tampilkan sebagian (mis. NIK tersamar) pada halaman publik.
- **Berkas:** validasi tipe dan ukuran unggahan, simpan di luar folder web, nama berkas diacak, hitung checksum SHA-256 untuk memastikan berkas tidak berubah.
- **Serah terima sertipikat asli:** sertipikat asli yang diserahkan tidak dikembalikan kepada pemilik, jadi sistem mencatat berita acara serah terima dan checksum scan sebelum penyerahan.
- **Segel dokumen elektronik:** di prototipe, draf sertipikat elektronik diberi hash SHA-256 dan QR yang menaut ke halaman cek keaslian, sebagai pengganti simulasi tanda tangan elektronik; produksi memakai tanda tangan elektronik tersertifikasi BSrE.
- **Audit:** log aktivitas hanya bisa ditambah (append-only), memuat pengguna, waktu, aksi, dan alamat IP.
- **Transport & konfigurasi:** HTTPS, CORS dibatasi, rahasia di variabel lingkungan, pembatasan laju (rate limit) pada login dan halaman cek keaslian publik.
- **Kinerja & ketersediaan:** halaman daftar < 2 detik untuk 10.000 permohonan (dengan indeks dan paginasi); pencadangan basis data terjadwal.
- **Kegunaan:** antarmuka berbahasa Indonesia, responsif di ponsel (pemohon umumnya memakai ponsel), kontras dan ukuran huruf mudah dibaca.
- **Data uji:** prototipe hanya memakai data fiktif; data pertanahan asli tidak boleh dimasukkan ke lingkungan pengembangan.

## 8. Arsitektur & teknologi

&#91;embedded content: arsitektur sistem · 3 lapisan, 5 modul API\]

Frontend memanggil satu API Go lewat REST/JSON. API menyimpan data ke PostgreSQL dan berkas scan ke penyimpanan berkas.

| Lapisan | Teknologi | Catatan |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS | Satu aplikasi, menu dan halaman menyesuaikan peran |
| Backend | Go, REST API, JWT | Middleware peran di setiap endpoint |
| Basis data | PostgreSQL | Migrasi skema berversi |
| Berkas | Disk lokal untuk prototipe | Bisa dipindah ke object storage (mis. MinIO/S3) |
| Penyebaran | Docker Compose | Satu perintah untuk frontend, API, dan basis data |
| Dokumen elektronik | Pustaka PDF dan QR di Go | Draf sertipikat-el dengan hash dan penanda SIMULASI |

**Endpoint utama (draf)**

- `POST /api/auth/login`
- `GET/POST /api/permohonan` dan `GET /api/permohonan/:id`
- `POST /api/permohonan/:id/dokumen` (unggah)
- `POST /api/permohonan/:id/status` (setujui, tolak, minta perbaikan)
- `GET /api/arsip` (pencarian, filter, dan unduh draf sertipikat-el)
- `GET /api/verifikasi/:kode` (publik, data tersamar)
- `GET /api/audit` dan `/api/users` (Admin)

## 9. Model data

Delapan tabel utama di PostgreSQL; seluruh perubahan status disimpan sebagai riwayat, bukan menimpa data lama.

| Tabel | Isi utama | Relasi |
| --- | --- | --- |
| users | id, nama, email, password\_hash, role (masyarakat / loket / verifikasi / admin), aktif | 1 user : banyak permohonan |
| permohonan | id, nomor\_tiket, pemohon\_id, jenis\_pemohon (perorangan / badan hukum), dikuasakan, status, catatan, dibuat\_pada | milik 1 user; punya banyak dokumen dan riwayat |
| sertipikat\_analog | id, permohonan\_id, jenis\_hak, nomor\_hak, pemegang\_hak, luas\_m2, lokasi, tahun\_terbit, serah\_terima\_pada, status\_warkah | 1 permohonan : 1 sertipikat analog |
| dokumen | id, permohonan\_id, jenis (ktp / kk / surat\_kuasa / akta\_pendirian / foto\_sertipikat / scan\_sertipikat), path, mime, ukuran, checksum\_sha256, diunggah\_oleh | milik 1 permohonan |
| pnbp | id, permohonan\_id, status\_bayar (belum / lunas), dicatat\_oleh, dicatat\_pada | 1 permohonan : 1 catatan PNBP (simulasi) |
| sertipikat\_elektronik | id, permohonan\_id, nomor, edisi, kode\_verifikasi, hash\_dokumen, diterbitkan\_oleh, tanggal\_terbit, simulasi | 1 permohonan : 1 draf sertipikat-el |
| riwayat\_status | id, permohonan\_id, dari\_status, ke\_status, oleh\_user\_id, catatan, waktu | milik 1 permohonan |
| audit\_log | id, user\_id, aksi, objek, ip, waktu | append-only |

Status permohonan: Diajukan, Berkas diterima, Menunggu validasi, Perlu perbaikan, Ditolak, Terbit (simulasi).

## 10. Rencana pengembangan

&#91;embedded content: rencana pengembangan · 5 fase, 3 gerbang\]

Pembangunan dibagi lima fase dengan tiga gerbang pemeriksaan. Fitur P0 selesai di fase 3 dan diuji pada Gerbang 2; fitur P1 dikerjakan setelahnya. Durasi tiap fase belum ditetapkan dan menunggu target waktu dari pembimbing.

## 11. Risiko, asumsi & pertanyaan terbuka

| Risiko / asumsi | Dampak | Penanganan |
| --- | --- | --- |
| Draf simulasi disangka sertipikat elektronik resmi | Kesalahpahaman hukum | Penanda "SIMULASI, bukan sertipikat elektronik resmi" di setiap halaman dan di PDF |
| Data pribadi bocor | Pelanggaran UU PDP | Data fiktif saja, akses berperan, audit log, samarkan data publik |
| Prosedur atau persyaratan alih media berubah | Alur tidak sesuai kantor | Konfirmasi prosedur terbaru ke pembimbing; daftar persyaratan dibuat dapat diatur Admin |
| Sertipikat asli yang diserahkan tidak dikembalikan | Risiko kehilangan atau sengketa | Berita acara serah terima dan checksum scan sebelum penyerahan |
| Kualitas scan buruk | Validasi gagal | Standar resolusi minimal dan status "Perlu perbaikan" |
| Waktu magang terbatas | Fitur tidak selesai | Kerjakan P0 dulu; P1 dan P2 sebagai pengembangan lanjutan |
| Unduh paket Go dibatasi di lingkungan kerja saya | Build backend tertunda | Verifikasi build di laptop Anda, atau pakai mirror paket yang diizinkan |

**Pertanyaan terbuka untuk pembimbing**

- [ ] Apakah prototipe boleh meniru tampilan sertipikat elektronik resmi, atau cukup draf generik dengan penanda simulasi?: boleh meniru tampilan sertipikat elektronik resmi
- [ ] Siapa yang menerbitkan sertipikat elektronik: petugas verifikasi atau pejabat tersendiri?: petugas verifikasi
- [ ] Apakah pengajuan sepenuhnya online, atau pemohon tetap datang ke loket (prototipe mengasumsikan online, lalu serah sertipikat asli di loket)?: Sepenuhnya online
- [ ] Aturan mana yang menjadi acuan kantor: Permen ATR/BPN No. 1 Tahun 2021 (disebut CNN Indonesia) dan Permen ATR/BPN No. 3 Tahun 2023 (isinya belum saya verifikasi)?: saya belum tau
- [ ] Apakah perlu terhubung ke sistem internal (mis. KKP, Sentuh Tanahku) atau berdiri sendiri?: untuk sekarang berdiri sendiri
- [ ] Berapa target waktu proses, dan siapa penguji serta format demo di akhir magang? secepatnya, anggap saja saya sedang mengerjakan sebuah freelance yang di pesan oleh klien yaitu dari atr/bpn

## Sumber

- [detikProperti: Ubah Sertifikat Tanah Jadi Elektronik Diminta Sertifikat Asli, Kenapa?](https://www.detik.com/properti/tips-dan-panduan/d-7942184/ubah-sertifikat-tanah-jadi-elektronik-diminta-sertifikat-asli-kenapa) (1 Juni 2025): sertipikat asli diserahkan dan menjadi warkah
- [CNN Indonesia: Sertifikat Tanah Digital Sudah Berlaku, Ini Perbedaan dengan yang Lama](https://www.cnnindonesia.com/nasional/20250619143222-20-1241494/sertifikat-tanah-digital-sudah-berlaku-ini-perbedaan-dengan-yang-lama) (19 Juni 2025): persyaratan alih media, tanda tangan elektronik BSrE, QR, PNBP, dasar hukum

Disusun dari dua artikel berita; sumber primer (peraturan resmi) belum bisa saya buka, jadi persyaratan perlu dikonfirmasi ke kantor pertanahan.
