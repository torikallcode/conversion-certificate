import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Files,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { DashboardData, Paged, Permohonan } from '../types';
import { StatusBadge, Spinner } from '../components/ui';
import { formatDateTime, roleLabel } from '../utils';

function StatCard({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warning' | 'success';
  icon: typeof Files;
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-orange-50 text-orange-700 border-orange-100'
      : tone === 'success'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : 'bg-white text-slate-700 border-slate-200';
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <p className="mt-3 text-3xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function RecentList({ items }: { items: Permohonan[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-500">
        Belum ada permohonan untuk ditampilkan.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/permohonan/${item.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-slate-800">
                {item.nomor_tiket}
              </p>
              <p className="truncate text-xs text-slate-500">
                {item.nama_pemohon} · {item.jenis_hak} {item.nomor_hak}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={item.status} />
              <span className="text-[11px] text-slate-400">{formatDateTime(item.dibuat_pada)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [list, setList] = useState<Paged<Permohonan> | null>(null);
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api<Paged<Permohonan>>('/permohonan?per_page=6')
      .then(setList)
      .catch((e) => setError(e.message));
    if (user.role !== 'masyarakat') {
      api<DashboardData>('/dashboard')
        .then(setStats)
        .catch(() => undefined);
    }
  }, [user]);

  if (!user) return null;
  if (!list && !error) return <Spinner />;

  const counts = list?.counts ?? {};
  const total = list?.total ?? 0;
  const perbaikan = counts['Perlu perbaikan'] ?? 0;
  const diproses =
    (counts['Diajukan'] ?? 0) + (counts['Berkas diterima'] ?? 0) + (counts['Menunggu validasi'] ?? 0);
  const terbit = counts['Terbit (simulasi)'] ?? 0;

  const greeting = `Selamat datang, ${user.nama.split(' ')[0]}`;
  const subtitle: Record<string, string> = {
    masyarakat: 'Pantau permohonan alih media dan persyaratan yang perlu dilengkapi.',
    loket: 'Antrean penerimaan sertipikat asli, pemeriksaan berkas, dan pencatatan PNBP.',
    verifikasi: 'Permohonan yang menunggu validasi kecocokan data dengan warkah.',
    admin: 'Ringkasan layanan, pengguna, dan jejak audit sistem.',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {roleLabel[user.role]}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{greeting}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle[user.role]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'masyarakat' && (
            <Link to="/permohonan/baru" className="btn-primary">
              <FilePlus2 className="h-4 w-4" />
              Ajukan Alih Media
            </Link>
          )}
          {user.role === 'loket' && (
            <Link to="/loket" className="btn-primary">
              <Files className="h-4 w-4" />
              Buka Antrean Loket
            </Link>
          )}
          {user.role === 'verifikasi' && (
            <Link to="/validasi" className="btn-primary">
              <ShieldCheck className="h-4 w-4" />
              Buka Antrean Validasi
            </Link>
          )}
          <Link to="/verifikasi" className="btn-secondary">
            <QrCode className="h-4 w-4" />
            Cek Keaslian
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {perbaikan > 0 && user.role === 'masyarakat' && (
        <Link
          to="/permohonan?status=Perlu%20perbaikan"
          className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 transition hover:bg-orange-100"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="font-semibold">
              {perbaikan} permohonan perlu perbaikan berkas
            </p>
            <p className="text-orange-800/80">
              Buka permohonan, unggah berkas yang diminta, lalu kirim perbaikan.
            </p>
          </div>
          <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0" />
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {user.role === 'masyarakat' ? (
          <>
            <StatCard label="Total permohonan" value={total} icon={Files} />
            <StatCard label="Sedang diproses" value={diproses} icon={Clock3} />
            <StatCard label="Perlu perbaikan" value={perbaikan} tone={perbaikan ? 'warning' : 'default'} icon={AlertTriangle} />
            <StatCard label="Terbit (simulasi)" value={terbit} tone="success" icon={CheckCircle2} />
          </>
        ) : user.role === 'loket' ? (
          <>
            <StatCard label="Menunggu diterima" value={counts['Diajukan'] ?? 0} icon={Files} />
            <StatCard label="Berkas diterima" value={counts['Berkas diterima'] ?? 0} icon={Clock3} />
            <StatCard label="Menunggu validasi" value={counts['Menunggu validasi'] ?? 0} icon={ShieldCheck} />
            <StatCard label="Total permohonan" value={total} icon={Files} />
          </>
        ) : user.role === 'verifikasi' ? (
          <>
            <StatCard
              label="Menunggu validasi"
              value={counts['Menunggu validasi'] ?? 0}
              tone={counts['Menunggu validasi'] ? 'warning' : 'default'}
              icon={ShieldCheck}
            />
            <StatCard label="Perlu perbaikan" value={perbaikan} icon={AlertTriangle} />
            <StatCard label="Terbit (simulasi)" value={terbit} tone="success" icon={CheckCircle2} />
            <StatCard label="Total permohonan" value={total} icon={Files} />
          </>
        ) : (
          <>
            <StatCard label="Total permohonan" value={stats?.total ?? total} icon={Files} />
            <StatCard label="Pengguna" value={stats?.total_users ?? '-'} icon={Users} />
            <StatCard
              label="Rata-rata proses"
              value={stats ? `${stats.rata_rata_hari.toFixed(1)} hari` : '-'}
              icon={Clock3}
            />
            <StatCard label="Terbit (simulasi)" value={terbit} tone="success" icon={CheckCircle2} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {user.role === 'masyarakat' ? 'Permohonan terbaru' : 'Permohonan terbaru'}
            </h2>
            <Link to="/permohonan" className="text-xs font-semibold text-emerald-700 hover:underline">
              Lihat semua
            </Link>
          </div>
          <RecentList items={list?.items ?? []} />
        </section>

        <aside className="space-y-4">
          {user.role === 'masyarakat' ? (
            <section className="card p-4">
              <h2 className="text-sm font-semibold text-slate-800">Alur alih media</h2>
              <ol className="mt-4 space-y-4">
                {[
                  { t: 'Ajukan & unggah', d: 'Isi data sertipikat dan unggah KTP, KK, foto sertipikat.' },
                  { t: 'Serahkan sertipikat asli', d: 'Datang ke loket; petugas mencatat serah terima dan warkah.' },
                  { t: 'Validasi data', d: 'Petugas verifikasi memeriksa kecocokan data dengan warkah.' },
                  { t: 'Terbit draf', d: 'Jika disetujui, draf sertipikat elektronik dengan QR dapat diunduh.' },
                ].map((step, i) => (
                  <li key={step.t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{step.t}</p>
                      <p className="text-xs text-slate-500">{step.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : user.role === 'admin' ? (
            <section className="card p-4">
              <h2 className="text-sm font-semibold text-slate-800">Aktivitas terbaru</h2>
              <ul className="mt-3 space-y-3">
                {(stats?.aktivitas_baru ?? []).length === 0 && (
                  <li className="text-xs text-slate-400">Belum ada aktivitas.</li>
                )}
                {(stats?.aktivitas_baru ?? []).slice(0, 6).map((a) => (
                  <li key={a.id} className="text-xs">
                    <p className="font-semibold text-slate-700">{a.aksi}</p>
                    <p className="truncate text-slate-500">{a.objek}</p>
                    <p className="text-[11px] text-slate-400">
                      {a.nama} · {formatDateTime(a.waktu)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="card p-4">
              <h2 className="text-sm font-semibold text-slate-800">Pintasan</h2>
              <div className="mt-3 space-y-2">
                <Link
                  to={user.role === 'loket' ? '/loket' : '/validasi'}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {user.role === 'loket' ? 'Antrean loket' : 'Antrean validasi'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/permohonan"
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Semua permohonan
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/verifikasi"
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Cek keaslian dokumen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Catatan prototipe
            </div>
            Seluruh data adalah fiktif. Draf sertipikat elektronik yang dihasilkan bukan dokumen resmi
            dan tidak memiliki akibat hukum.
          </section>
        </aside>
      </div>
    </div>
  );
}
