import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { AuditItem, Paged } from '../types';
import { Pagination, Spinner } from '../components/ui';
import { formatDateTime } from '../utils';

const actionTone = (aksi: string) => {
  if (aksi.startsWith('login') || aksi.startsWith('registrasi')) return 'bg-sky-100 text-sky-800';
  if (aksi.startsWith('keputusan') || aksi.startsWith('sertipikat')) return 'bg-emerald-100 text-emerald-800';
  if (aksi.includes('ditolak') || aksi.includes('gagal')) return 'bg-red-100 text-red-800';
  if (aksi.startsWith('user')) return 'bg-violet-100 text-violet-800';
  if (aksi.startsWith('dokumen')) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

export default function AdminAudit() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AuditItem> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api<Paged<AuditItem>>(`/audit?page=${page}&per_page=20&q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [page, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Log Audit</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catatan aktivitas append-only: login, perubahan status, unduhan berkas, dan pengelolaan
          pengguna.
        </p>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Cari aksi, objek, atau nama pengguna..."
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
                  <th className="table-th">Waktu</th>
                  <th className="table-th">Pengguna</th>
                  <th className="table-th">Aksi</th>
                  <th className="table-th">Objek</th>
                  <th className="table-th">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((item) => (
                  <tr key={item.id}>
                    <td className="table-td whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(item.waktu)}
                    </td>
                    <td className="table-td text-sm">{item.nama}</td>
                    <td className="table-td">
                      <span className={`badge ${actionTone(item.aksi)}`}>{item.aksi}</span>
                    </td>
                    <td className="table-td max-w-md truncate font-mono text-xs text-slate-600" title={item.objek}>
                      {item.objek}
                    </td>
                    <td className="table-td font-mono text-xs text-slate-500">{item.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Tidak ada catatan audit.</p>
          )}
          {data && (
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
          )}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Tabel audit_log dilindungi trigger basis data yang menolak UPDATE dan DELETE, sehingga catatan
        hanya bisa ditambah.
      </div>
    </div>
  );
}
