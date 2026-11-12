import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, ShieldCheck, UserCog } from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import type { Paged, Role, User } from '../types';
import { Modal, Pagination, Spinner } from '../components/ui';
import { formatDate, roleLabel } from '../utils';

const roles: Role[] = ['masyarakat', 'loket', 'verifikasi', 'admin'];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { notify } = useToast();
  const [data, setData] = useState<Paged<User> | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState({
    nama: '',
    email: '',
    password: '',
    role: 'masyarakat' as Role,
    nik: '',
    no_hp: '',
  });
  const [createError, setCreateError] = useState('');

  const load = useCallback(() => {
    api<Paged<User>>(`/users?page=${page}&per_page=10&q=${encodeURIComponent(query)}`)
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function updateUser(id: number, patch: { role?: Role; aktif?: boolean }) {
    setBusyId(id);
    try {
      await api(`/users/${id}`, { method: 'PUT', body: patch });
      notify('Data pengguna diperbarui.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal memperbarui pengguna.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError('');
    try {
      await api('/users', { method: 'POST', body: form });
      notify('Pengguna baru berhasil dibuat.', 'success');
      setOpen(false);
      setForm({ nama: '', email: '', password: '', role: 'masyarakat', nik: '', no_hp: '' });
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Gagal membuat pengguna.');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengguna & Peran</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola akun, ubah peran, dan nonaktifkan akses. Setiap akun hanya memegang satu peran.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah pengguna
        </button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Cari nama atau email..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!data && !error ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Pengguna</th>
                  <th className="table-th">Peran</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Dibuat</th>
                  <th className="table-th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((u) => (
                  <tr key={u.id} className={busyId === u.id ? 'opacity-60' : ''}>
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-900">
                          {u.nama.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.nama}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <select
                        className="input max-w-[180px] py-1.5 text-xs"
                        value={u.role}
                        disabled={busyId === u.id || u.id === me?.id}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-td">
                      <span
                        className={`badge ${
                          u.aktif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {u.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="table-td text-xs text-slate-500">{formatDate(u.dibuat_pada)}</td>
                    <td className="table-td text-right">
                      <button
                        type="button"
                        disabled={busyId === u.id || u.id === me?.id}
                        onClick={() => updateUser(u.id, { aktif: !u.aktif })}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Tidak ada pengguna cocok.</p>
          )}
          {data && (
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Pemisahan tugas: petugas loket yang menginput data tidak boleh menjadi petugas verifikasi
        untuk permohonan yang sama. Sistem menolak keputusan dari pengguna yang sama dengan penginput.
      </div>

      <Modal open={open} title="Tambah pengguna" onClose={() => setOpen(false)}>
        <form onSubmit={createUser} className="space-y-3">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nama lengkap</label>
              <input
                className="input"
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kata sandi</label>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 8 karakter"
              />
            </div>
            <div>
              <label className="label">Peran</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">No. HP</label>
              <input
                className="input"
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">NIK (opsional)</label>
              <input
                className="input"
                maxLength={16}
                value={form.nik}
                onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn-primary" disabled={createBusy}>
              {createBusy ? 'Menyimpan...' : 'Simpan pengguna'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
