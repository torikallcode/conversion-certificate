import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Landmark } from 'lucide-react';
import { ApiError } from '../api';
import { useAuth } from '../auth';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nama: '',
    email: '',
    nik: '',
    no_hp: '',
    password: '',
    konfirmasi: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      setError('NIK harus 16 angka.');
      return;
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (form.password !== form.konfirmasi) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setBusy(true);
    try {
      await register({
        nama: form.nama,
        email: form.email,
        nik: form.nik,
        no_hp: form.no_hp,
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pendaftaran gagal, coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        SIMULASI — data yang Anda masukkan hanya untuk demonstrasi.
      </div>
      <div className="flex flex-1 items-start justify-center px-5 py-10">
        <div className="w-full max-w-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-brand-900 p-2 text-white">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Alih Media Sertipikat</p>
              <p className="text-xs text-slate-500">Pendaftaran akun masyarakat</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">Buat akun masyarakat</h1>
            <p className="mt-1 text-sm text-slate-500">
              Akun ini dipakai untuk mengajukan alih media dan memantau status permohonan.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="nama">
                    Nama lengkap
                  </label>
                  <input
                    id="nama"
                    required
                    className="input"
                    value={form.nama}
                    onChange={(e) => set('nama', e.target.value)}
                    placeholder="Sesuai KTP"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="nama@contoh.test"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="hp">
                    No. HP
                  </label>
                  <input
                    id="hp"
                    className="input"
                    value={form.no_hp}
                    onChange={(e) => set('no_hp', e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="nik">
                    NIK (16 angka)
                  </label>
                  <input
                    id="nik"
                    inputMode="numeric"
                    maxLength={16}
                    className="input"
                    value={form.nik}
                    onChange={(e) => set('nik', e.target.value.replace(/\D/g, ''))}
                    placeholder="3201xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="password">
                    Kata sandi
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    className="input"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="konfirmasi">
                    Ulangi kata sandi
                  </label>
                  <input
                    id="konfirmasi"
                    type="password"
                    required
                    className="input"
                    value={form.konfirmasi}
                    onChange={(e) => set('konfirmasi', e.target.value)}
                    placeholder="Ulangi kata sandi"
                  />
                </div>
              </div>

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Mendaftarkan...' : 'Daftar'}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-5 text-sm text-slate-500">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
