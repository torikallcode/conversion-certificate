import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Landmark,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import type { VerifikasiPublik } from '../types';
import { formatDate, formatLuas } from '../utils';
import { Field } from '../components/Field';
import { Spinner } from '../components/ui';

export default function PublicVerify() {
  const { kode: param } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [kode, setKode] = useState('');
  const [result, setResult] = useState<VerifikasiPublik | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const cari = useCallback(async (value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api<VerifikasiPublik>(`/verifikasi/${encodeURIComponent(v)}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memeriksa kode verifikasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (param) {
      setKode(param);
      cari(param);
    }
  }, [param, cari]);

  const stopScan = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => stopScan, [stopScan]);

  async function startScan() {
    setScanError('');
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } })
      .BarcodeDetector;
    if (!Detector) {
      setScanError(
        'Browser ini belum mendukung pemindaian QR langsung. Masukkan kode verifikasi secara manual.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new Detector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = String(codes[0].rawValue ?? '');
            const found = raw.split('?')[0].split('/').filter(Boolean).pop() ?? raw;
            stopScan();
            navigate(`/verifikasi/${encodeURIComponent(found.toUpperCase())}`);
            return;
          }
        } catch {
          /* lanjutkan pemindaian */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setScanning(false);
      setScanError('Tidak dapat mengakses kamera. Periksa izin kamera atau masukkan kode manual.');
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = kode.trim().toUpperCase();
    if (!v) return;
    if (v === (param ?? '').toUpperCase()) {
      cari(v);
    } else {
      navigate(`/verifikasi/${encodeURIComponent(v)}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-900 sm:text-xs">
        <AlertTriangle className="h-3.5 w-3.5" />
        SIMULASI — hasil pemeriksaan bukan bukti kepemilikan tanah yang sah.
      </div>

      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Alih Media Sertipikat</p>
              <p className="text-xs text-brand-200">Cek keaslian dokumen — prototipe</p>
            </div>
          </Link>
          <Link
            to={user ? '/' : '/login'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {user ? 'Kembali ke dasbor' : 'Masuk'}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cek Keaslian Sertipikat Elektronik</h1>
          <p className="mt-1 text-sm text-slate-500">
            Masukkan kode verifikasi yang tercetak pada draf sertipikat, atau pindai QR pada dokumen.
          </p>
        </div>

        <form onSubmit={submit} className="card p-4 sm:p-5">
          <label className="label" htmlFor="kode">
            Kode verifikasi
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="kode"
                className="input pl-9 font-mono uppercase tracking-wider"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="Contoh: ABCD2345WXYZ"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn-primary sm:w-auto" disabled={loading}>
              {loading ? 'Memeriksa...' : 'Periksa'}
            </button>
            <button type="button" className="btn-secondary" onClick={startScan}>
              <Camera className="h-4 w-4" />
              Pindai QR
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Kode verifikasi bersifat publik. Data pribadi ditampilkan tersamar sesuai UU PDP.
          </p>

          {scanError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {scanError}
            </p>
          )}

          {scanning && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black">
              <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <span className="inline-flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> Arahkan kamera ke QR pada dokumen
                </span>
                <button
                  type="button"
                  onClick={stopScan}
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
                >
                  <X className="h-3.5 w-3.5" /> Batal
                </button>
              </div>
            </div>
          )}
        </form>

        {loading && <Spinner label="Memeriksa kode verifikasi..." />}

        {!loading && error && (
          <div className="card border-red-200 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Dokumen tidak terverifikasi</p>
                <p className="mt-1 text-sm text-slate-600">{error}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Periksa kembali kode atau QR. Jika masih gagal, dokumen mungkin tidak diterbitkan
                  oleh sistem simulasi ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-600 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7" />
                <div>
                  <p className="font-bold">Dokumen terdaftar pada sistem simulasi</p>
                  <p className="text-xs text-emerald-100">
                    Nomor {result.nomor} · Edisi {result.edisi}
                  </p>
                </div>
              </div>
              <span className="badge bg-amber-300 text-amber-950">SIMULASI</span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Jenis hak" value={result.jenis_hak} />
              <Field label="Nomor hak" value={result.nomor_hak} />
              <Field label="Pemegang hak (tersamar)" value={result.pemegang_hak} />
              <Field label="Luas" value={formatLuas(result.luas_m2)} />
              <div className="sm:col-span-2">
                <Field label="Lokasi" value={result.lokasi} />
              </div>
              <Field label="Tahun terbit" value={result.tahun_terbit ?? '-'} />
              <Field label="Status permohonan" value={result.status_permohonan} />
              <Field label="Nomor tiket" value={result.nomor_tiket} mono />
              <Field label="Tanggal terbit draf" value={formatDate(result.tanggal_terbit)} />
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hash dokumen (SHA-256)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">{result.hash_dokumen}</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {result.catatan_simulasi} Data pribadi ditampilkan sebagian untuk pelindungan data.
                </span>
              </div>
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Cara lain: buka draf PDF sertipikat, lalu pindai QR di kanan atas. Tautan QR mengarah ke
            halaman ini dengan kode terisi otomatis.
          </div>
        )}
      </main>

      <footer className="px-4 py-5 text-center text-xs text-slate-500">
        Prototipe Alih Media Sertipikat Analog ke Elektronik · data fiktif · bukan layanan resmi
        ATR/BPN
      </footer>
    </div>
  );
}
