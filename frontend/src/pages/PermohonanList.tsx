import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePlus2, Search } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Paged, Permohonan } from '../types';
import { STATUS_LIST } from '../types';
import { EmptyState, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDate, statusMeta } from '../utils';

export default function PermohonanList() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? 'semua');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Permohonan> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api<Paged<Permohonan>>(
      `/permohonan?page=${page}&per_page=10&status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`
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
  }, [page, status, query, user?.id]);

  const counts = data?.counts ?? {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const isMasyarakat = user?.role === 'masyarakat';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isMasyarakat ? 'Permohonan Saya' : 'Semua Permohonan'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isMasyarakat
              ? 'Semua permohonan alih media yang Anda ajukan beserta status terkininya.'
              : 'Daftar permohonan lintas pemohon sesuai kewenangan peran Anda.'}
          </p>
        </div>
        {isMasyarakat && (
          <Link to="/permohonan/baru" className="btn-primary">
            <FilePlus2 className="h-4 w-4" />
            Ajukan Alih Media
          </Link>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setStatus('semua');
              setPage(1);
            }}
            className={`badge border px-3 py-1.5 ${
              status === 'semua'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            Semua
            <span className="ml-1 rounded-full bg-black/10 px-1.5 text-[10px]">{totalAll}</span>
          </button>
          {STATUS_LIST.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`badge border px-3 py-1.5 ${
                status === s
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : `${statusMeta[s].badge} border-transparent hover:border-slate-300`
              }`}
            >
              {s}
              <span className="ml-1 rounded-full bg-black/10 px-1.5 text-[10px]">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="relative mt-3 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Cari nomor tiket, nama pemohon, nomor hak, atau lokasi..."
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {!data && !error ? (
          <Spinner />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada permohonan"
            description="Coba ubah filter status atau kata kunci pencarian."
            action={
              isMasyarakat ? (
                <Link to="/permohonan/baru" className="btn-primary">
                  Ajukan permohonan baru
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-th">Nomor Tiket</th>
                    {!isMasyarakat && <th className="table-th">Pemohon</th>}
                    <th className="table-th">Sertipikat</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Diajukan</th>
                    <th className="table-th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="table-td font-mono text-xs font-semibold text-slate-800">
                        {item.nomor_tiket}
                      </td>
                      {!isMasyarakat && (
                        <td className="table-td">
                          <p className="font-medium text-slate-800">{item.nama_pemohon}</p>
                          <p className="text-xs text-slate-500">
                            {item.jenis_pemohon === 'badan_hukum' ? item.nama_badan_hukum : 'Perorangan'}
                          </p>
                        </td>
                      )}
                      <td className="table-td">
                        <p className="font-medium text-slate-700">{item.jenis_hak}</p>
                        <p className="text-xs text-slate-500">{item.nomor_hak}</p>
                      </td>
                      <td className="table-td">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="table-td text-xs text-slate-500">{formatDate(item.dibuat_pada)}</td>
                      <td className="table-td text-right">
                        <Link
                          to={`/permohonan/${item.id}`}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {data?.items.map((item) => (
                <li key={item.id}>
                  <Link to={`/permohonan/${item.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {item.nomor_tiket}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {item.nama_pemohon} · {item.jenis_hak} {item.nomor_hak}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.lokasi} · {formatDate(item.dibuat_pada)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {data && (
              <Pagination
                page={data.page}
                perPage={data.per_page}
                total={data.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
