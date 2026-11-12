export type Role = 'masyarakat' | 'loket' | 'verifikasi' | 'admin';

export interface User {
  id: number;
  nama: string;
  email: string;
  role: Role;
  aktif: boolean;
  nik?: string;
  no_hp?: string;
  dibuat_pada: string;
}

export interface Permohonan {
  id: number;
  nomor_tiket: string;
  pemohon_id: number;
  nama_pemohon: string;
  jenis_pemohon: 'perorangan' | 'badan_hukum';
  nama_badan_hukum: string;
  dikuasakan: boolean;
  nik: string;
  alamat: string;
  no_hp: string;
  jenis_hak: string;
  nomor_hak: string;
  lokasi: string;
  status: PermohonanStatus;
  catatan: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

export type PermohonanStatus =
  | 'Diajukan'
  | 'Berkas diterima'
  | 'Menunggu validasi'
  | 'Perlu perbaikan'
  | 'Ditolak'
  | 'Terbit (simulasi)';

export const STATUS_LIST: PermohonanStatus[] = [
  'Diajukan',
  'Berkas diterima',
  'Menunggu validasi',
  'Perlu perbaikan',
  'Ditolak',
  'Terbit (simulasi)',
];

export interface SertipikatAnalog {
  id: number;
  permohonan_id: number;
  jenis_hak: string;
  nomor_hak: string;
  pemegang_hak: string;
  luas_m2: number | null;
  lokasi: string;
  tahun_terbit: number | null;
  serah_terima_pada: string | null;
  status_warkah: string;
  ktp_cocok: boolean;
  kk_cocok: boolean;
  berita_acara: string;
  diperbarui_pada: string;
}

export interface Dokumen {
  id: number;
  permohonan_id: number;
  jenis: string;
  nama_asli: string;
  mime: string;
  ukuran: number;
  checksum_sha256: string;
  diunggah_oleh: number | null;
  dibuat_pada: string;
}

export interface PNBP {
  id: number;
  permohonan_id: number;
  status_bayar: 'belum' | 'lunas';
  nominal: number;
  dicatat_oleh: number | null;
  dicatat_pada: string;
}

export interface SertipikatElektronik {
  id: number;
  permohonan_id: number;
  nomor: string;
  edisi: string;
  kode_verifikasi: string;
  hash_dokumen: string;
  diterbitkan_oleh: number | null;
  tanggal_terbit: string;
  simulasi: boolean;
}

export interface RiwayatStatus {
  id: number;
  permohonan_id: number;
  dari_status: string;
  ke_status: string;
  oleh_user_id: number | null;
  oleh_nama: string;
  catatan: string;
  waktu: string;
}

export interface Kelengkapan {
  dokumen_wajib: string[];
  dokumen_ada: string[];
  kurang: string[];
  lengkap: boolean;
  data_analog_lengkap: boolean;
  pnbp_lunas: boolean;
  ktp_cocok: boolean;
  kk_cocok: boolean;
}

export interface PermohonanDetail {
  permohonan: Permohonan;
  pemohon: User;
  sertipikat_analog: SertipikatAnalog | null;
  dokumen: Dokumen[];
  pnbp: PNBP | null;
  riwayat: RiwayatStatus[];
  sertipikat_elektronik: SertipikatElektronik | null;
  kelengkapan: Kelengkapan;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  counts?: Record<string, number>;
}

export interface DashboardData {
  counts: Record<string, number>;
  total: number;
  total_users: number;
  bulan_ini: number;
  rata_rata_hari: number;
  aktivitas_baru: { id: number; nama: string; aksi: string; objek: string; waktu: string }[];
}

export interface AuditItem {
  id: number;
  user_id: number | null;
  nama: string;
  aksi: string;
  objek: string;
  ip: string;
  waktu: string;
}

export interface VerifikasiPublik {
  valid: boolean;
  simulasi: boolean;
  catatan_simulasi: string;
  nomor: string;
  edisi: string;
  kode_verifikasi: string;
  tanggal_terbit: string;
  hash_dokumen: string;
  status_permohonan: string;
  nomor_tiket: string;
  jenis_hak: string;
  nomor_hak: string;
  pemegang_hak: string;
  lokasi: string;
  tahun_terbit: number | null;
  luas_m2: number | null;
}
