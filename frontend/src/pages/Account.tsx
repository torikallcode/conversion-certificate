import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ShieldCheck, UserCircle } from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { formatDate, maskNIK, roleLabel } from '../utils';
import { Field } from '../components/Field';

export default function Account() {
  const { user, logout } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({ password_lama: '', password_baru: '', konfirmasi: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password_baru.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (form.password_baru !== form.konfirmasi) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { password_lama: form.password_lama, password_baru: form.password_baru },
      });
      notify('Kata sandi berhasil diubah.', 'success');
      setForm({ password_lama: '', password_baru: '', konfirmasi: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Akun Saya</h1>
        <p className="mt-1 text-sm text-slate-500">Informasi akun dan pengaturan kata sandi.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-900">
              {user.nama.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{user.nama}</p>
              <span className="badge mt-1 bg-emerald-100 text-emerald-800">
                <UserCircle className="h-3.5 w-3.5" />
                {roleLabel[user.role]}
              </span>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={user.email} />
            <Field label="Status akun" value={user.aktif ? 'Aktif' : 'Nonaktif'} />
            <Field label="NIK" value={user.nik ? maskNIK(user.nik) : '-'} />
            <Field label="No. HP" value={user.no_hp || '-'} />
            <Field label="Terdaftar" value={formatDate(user.dibuat_pada)} />
          </dl>

          {user.role === 'masyarakat' && (
            <Link to="/permohonan" className="btn-secondary mt-5 w-full">
              Buka permohonan saya
            </Link>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-semibold text-slate-800">Ubah kata sandi</h2>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-3">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="label">Kata sandi lama</label>
              <input
                type="password"
                required
                className="input"
                value={form.password_lama}
                onChange={(e) => setForm({ ...form, password_lama: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kata sandi baru</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={form.password_baru}
                onChange={(e) => setForm({ ...form, password_baru: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ulangi kata sandi baru</label>
              <input
                type="password"
                required
                className="input"
                value={form.konfirmasi}
                onChange={(e) => setForm({ ...form, konfirmasi: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Simpan kata sandi'}
            </button>
          </form>

          <button
            type="button"
            onClick={logout}
            className="mt-4 text-xs font-semibold text-slate-500 hover:text-red-600"
          >
            Keluar dari akun ini
          </button>
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Prototipe simulasi: jangan gunakan kata sandi yang sama dengan akun penting Anda.
      </div>
    </div>
  );
}
