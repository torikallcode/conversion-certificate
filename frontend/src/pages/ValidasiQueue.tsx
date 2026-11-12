import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Search, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import type { Paged, Permohonan } from '../types';
import { EmptyState, Pagination, Spinner } from '../components/ui';
import { formatDateTime } from '../utils';

function daysWaiting(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function ValidasiQueue() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Permohonan> | null>(null);
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
    api<Paged<Permohonan>>(
      `/permohonan?status=Menunggu%20validasi&q=${encodeURIComponent(query)}&page=${page}&per_page=10`
    )
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
  }, [query, page]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Antrean Validasi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Validasi kecocokan data sertipikat dengan buku tanah/warkah, lalu beri keputusan.
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Menunggu</p>
          <p className="text-2xl font-extrabold text-amber-800">{data?.total ?? '—'}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Cari nomor tiket, pemohon, nomor hak..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!data && !error ? (
        <Spinner />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Tidak ada permohonan menunggu validasi"
            description="Antrean akan terisi setelah petugas loket mengajukan permohonan."
          />
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {data?.items.map((item) => {
            const days = daysWaiting(item.diperbarui_pada);
            return (
              <Link
                key={item.id}
                to={`/permohonan/${item.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold text-slate-800">{item.nomor_tiket}</span>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {item.nama_pemohon} · {item.jenis_hak} {item.nomor_hak}
                  </p>
                  <p className="text-xs text-slate-500">{item.lokasi}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    menunggu {days} hari
                  </p>
                  <p>{formatDateTime(item.diperbarui_pada)}</p>
                </div>
                <span className="btn-primary px-3 py-1.5 text-xs">
                  Validasi <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
          {data && (
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
          )}
        </div>
      )}
    </div>
  );
}
