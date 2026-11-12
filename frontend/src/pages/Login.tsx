import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Landmark, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { ApiError } from '../api';

const demoAccounts = [
  { role: 'Masyarakat', email: 'masyarakat@demo.test', password: 'Masyarakat123!' },
  { role: 'Petugas Loket', email: 'loket@demo.test', password: 'Loket123!' },
  { role: 'Petugas Verifikasi', email: 'verifikasi@demo.test', password: 'Verifikasi123!' },
  { role: 'Admin', email: 'admin@demo.test', password: 'Admin123!' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk, coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px, 64px 64px',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-2.5">
              <Landmark className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-bold">Alih Media Sertipikat</p>
              <p className="text-sm text-brand-200">Prototipe ATR/BPN</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-lg text-4xl font-extrabold leading-tight">
            Dari sertipikat analog menjadi draf sertipikat elektronik, dalam satu alur yang bisa
            dilacak.
          </h1>
          <p className="mt-5 max-w-md text-brand-100/90">
            Ajukan alih media, unggah persyaratan, pantau PNBP, dan unduh draf sertipikat elektronik
            dengan QR verifikasi.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            {[
              'Empat peran dengan hak akses terpisah',
              'Pemeriksaan berkas dan validasi data dalam satu layar',
              'Jejak audit untuk setiap perubahan status',
              'QR dan hash SHA-256 sebagai segel simulasi',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Prototipe simulasi dengan data fiktif. Tidak menggunakan tanda tangan elektronik BSrE
            dan tidak terhubung ke sistem resmi ATR/BPN.
          </span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-5 py-10 lg:min-h-0 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-brand-900 p-2 text-white">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Alih Media Sertipikat</p>
              <p className="text-xs text-amber-700">SIMULASI — bukan layanan resmi</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan akun sesuai peran. Setiap akun hanya memegang satu peran.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="nama@contoh.test"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">
                Kata sandi
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Memeriksa...' : 'Masuk'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Akun demo
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError('');
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="block font-semibold text-slate-700">{acc.role}</span>
                  <span className="block truncate text-[11px] text-slate-400">{acc.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Klik salah satu untuk mengisi email dan kata sandi demo.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 text-sm text-slate-500">
            <p>
              Belum punya akun masyarakat?{' '}
              <Link to="/daftar" className="font-semibold text-emerald-700 hover:underline">
                Daftar di sini
              </Link>
            </p>
            <p>
              Ingin memeriksa keaslian dokumen?{' '}
              <Link to="/verifikasi" className="font-semibold text-emerald-700 hover:underline">
                Buka cek keaslian
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
