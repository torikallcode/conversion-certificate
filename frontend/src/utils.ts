import type { PermohonanStatus, Role } from './types';

export const statusMeta: Record<PermohonanStatus, { badge: string; dot: string }> = {
  Diajukan: { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  'Berkas diterima': { badge: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  'Menunggu validasi': { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  'Perlu perbaikan': { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  Ditolak: { badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  'Terbit (simulasi)': { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
};

export const roleLabel: Record<Role, string> = {
  masyarakat: 'Masyarakat',
  loket: 'Petugas Loket',
  verifikasi: 'Petugas Verifikasi',
  admin: 'Admin',
};

export const jenisDokumenLabel: Record<string, string> = {
  ktp: 'KTP',
  kk: 'Kartu Keluarga',
  surat_kuasa: 'Surat Kuasa',
  akta_pendirian: 'Akta Pendirian',
  foto_sertipikat: 'Foto Sertipikat',
  scan_sertipikat: 'Scan Sertipikat Asli',
  lainnya: 'Dokumen Lain',
};

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRupiah(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatLuas(luas: number | null | undefined): string {
  if (luas === null || luas === undefined) return '-';
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(luas)} m²`;
}

export function maskNIK(nik: string): string {
  if (!nik) return '-';
  if (nik.length <= 6) return '******';
  return `${nik.slice(0, 6)}******${nik.slice(-4)}`;
}
