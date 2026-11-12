import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Search } from 'lucide-react';
import { api } from '../api';
import type { Paged, Permohonan } from '../types';
import { EmptyState, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDateTime } from '../utils';

const tabs = [
  { key: 'Diajukan', label: 'Menunggu diterima' },
  { key: 'Berkas diterima', label: 'Berkas diterima' },
  { key: 'Menunggu validasi', label: 'Diteruskan ke validasi' },
];

export default function LoketQueue() {
  const [tab, setTab] = useState('Diajukan');
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
      `/permohonan?status=${encodeURIComponent(tab)}&q=${encodeURIComponent(query)}&page=${page}&per_page=10`
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
  }, [tab, query, page]);

  const counts = data?.counts ?? {};

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Antrean Loket</h1>
        <p className="mt-1 text-sm text-slate-500">
          Terima sertipikat asli, periksa kelengkapan berkas, input data analog, dan catat PNBP.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Menunggu diterima', value: counts['Diajukan'] ?? 0, tone: 'bg-sky-50 text-sky-800 border-sky-100' },
          { label: 'Berkas diterima', value: counts['Berkas diterima'] ?? 0, tone: 'bg-amber-50 text-amber-800 border-amber-100' },
          { label: 'Menunggu validasi', value: counts['Menunggu validasi'] ?? 0, tone: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.tone}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={`badge border px-3 py-1.5 ${
                tab === t.key
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative mt-3 max-w-md">
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
            title="Antrean kosong"
            description={`Tidak ada permohonan dengan status "${tab}".`}
          />
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {data?.items.map((item) => (
            <Link
              key={item.id}
              to={`/permohonan/${item.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800">{item.nomor_tiket}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {item.nama_pemohon} · {item.jenis_hak} {item.nomor_hak}
                </p>
                <p className="text-xs text-slate-500">{item.lokasi}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDateTime(item.dibuat_pada)}
                </span>
                <span className="btn-secondary px-3 py-1.5">
                  Proses <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
          {data && (
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
          )}
        </div>
      )}
    </div>
  );
}
