CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('masyarakat', 'loket', 'verifikasi', 'admin')),
    aktif BOOLEAN NOT NULL DEFAULT TRUE,
    nik TEXT NOT NULL DEFAULT '',
    no_hp TEXT NOT NULL DEFAULT '',
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permohonan (
    id BIGSERIAL PRIMARY KEY,
    nomor_tiket TEXT NOT NULL UNIQUE,
    pemohon_id BIGINT NOT NULL REFERENCES users(id),
    jenis_pemohon TEXT NOT NULL CHECK (jenis_pemohon IN ('perorangan', 'badan_hukum')),
    nama_badan_hukum TEXT NOT NULL DEFAULT '',
    dikuasakan BOOLEAN NOT NULL DEFAULT FALSE,
    nik TEXT NOT NULL DEFAULT '',
    alamat TEXT NOT NULL DEFAULT '',
    no_hp TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN (
        'Diajukan', 'Berkas diterima', 'Menunggu validasi',
        'Perlu perbaikan', 'Ditolak', 'Terbit (simulasi)'
    )),
    catatan TEXT NOT NULL DEFAULT '',
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permohonan_status ON permohonan(status);
CREATE INDEX IF NOT EXISTS idx_permohonan_pemohon ON permohonan(pemohon_id);
CREATE INDEX IF NOT EXISTS idx_permohonan_dibuat ON permohonan(dibuat_pada DESC);

CREATE TABLE IF NOT EXISTS sertipikat_analog (
    id BIGSERIAL PRIMARY KEY,
    permohonan_id BIGINT NOT NULL UNIQUE REFERENCES permohonan(id) ON DELETE CASCADE,
    jenis_hak TEXT NOT NULL DEFAULT '',
    nomor_hak TEXT NOT NULL DEFAULT '',
    pemegang_hak TEXT NOT NULL DEFAULT '',
    luas_m2 NUMERIC(14, 2),
    lokasi TEXT NOT NULL DEFAULT '',
    tahun_terbit INT,
    serah_terima_pada TIMESTAMPTZ,
    status_warkah TEXT NOT NULL DEFAULT 'belum',
    ktp_cocok BOOLEAN NOT NULL DEFAULT FALSE,
    kk_cocok BOOLEAN NOT NULL DEFAULT FALSE,
    berita_acara TEXT NOT NULL DEFAULT '',
    diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dokumen (
    id BIGSERIAL PRIMARY KEY,
    permohonan_id BIGINT NOT NULL REFERENCES permohonan(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL CHECK (jenis IN (
        'ktp', 'kk', 'surat_kuasa', 'akta_pendirian',
        'foto_sertipikat', 'scan_sertipikat', 'lainnya'
    )),
    path TEXT NOT NULL,
    nama_asli TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    ukuran BIGINT NOT NULL DEFAULT 0,
    checksum_sha256 TEXT NOT NULL DEFAULT '',
    diunggah_oleh BIGINT REFERENCES users(id),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dokumen_permohonan ON dokumen(permohonan_id);

CREATE TABLE IF NOT EXISTS pnbp (
    id BIGSERIAL PRIMARY KEY,
    permohonan_id BIGINT NOT NULL UNIQUE REFERENCES permohonan(id) ON DELETE CASCADE,
    status_bayar TEXT NOT NULL CHECK (status_bayar IN ('belum', 'lunas')),
    nominal NUMERIC(14, 2) NOT NULL DEFAULT 0,
    dicatat_oleh BIGINT REFERENCES users(id),
    dicatat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sertipikat_elektronik (
    id BIGSERIAL PRIMARY KEY,
    permohonan_id BIGINT NOT NULL UNIQUE REFERENCES permohonan(id) ON DELETE CASCADE,
    nomor TEXT NOT NULL,
    edisi TEXT NOT NULL DEFAULT '1',
    kode_verifikasi TEXT NOT NULL UNIQUE,
    hash_dokumen TEXT NOT NULL,
    diterbitkan_oleh BIGINT REFERENCES users(id),
    tanggal_terbit TIMESTAMPTZ NOT NULL DEFAULT now(),
    simulasi BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS riwayat_status (
    id BIGSERIAL PRIMARY KEY,
    permohonan_id BIGINT NOT NULL REFERENCES permohonan(id) ON DELETE CASCADE,
    dari_status TEXT NOT NULL DEFAULT '',
    ke_status TEXT NOT NULL,
    oleh_user_id BIGINT REFERENCES users(id),
    catatan TEXT NOT NULL DEFAULT '',
    waktu TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riwayat_permohonan ON riwayat_status(permohonan_id, waktu);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    aksi TEXT NOT NULL,
    objek TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    waktu TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_waktu ON audit_log(waktu DESC);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log bersifat append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
