import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Link2,
  Loader2,
  LockKeyhole,
  PenLine,
  QrCode,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { api, apiBlob, ApiError, downloadFile } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import type { Dokumen, PermohonanDetail } from '../types';
import { EmptyState, Spinner, StatusBadge } from '../components/ui';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatLuas,
  formatRupiah,
  jenisDokumenLabel,
  maskNIK,
} from '../utils';

function SectionCard({
  title,
  description,
  action,
  id,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value || '-'}
      </dd>
    </div>
  );
}

function ChecklistRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      )}
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </li>
  );
}

export default function PermohonanDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const location = useLocation() as { state?: { baru?: boolean } };
  const [detail, setDetail] = useState<PermohonanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState<string | null>(null);
  const [serahBusy, setSerahBusy] = useState(false);
  const [analogBusy, setAnalogBusy] = useState(false);
  const [pnbpBusy, setPnbpBusy] = useState(false);
  const [validasiBusy, setValidasiBusy] = useState(false);
  const [keputusanBusy, setKeputusanBusy] = useState(false);
  const [perbaikanBusy, setPerbaikanBusy] = useState(false);

  const [serahForm, setSerahForm] = useState({
    ktp_cocok: false,
    kk_cocok: false,
    berita_acara: '',
  });
  const [analogForm, setAnalogForm] = useState({
    jenis_hak: '',
    nomor_hak: '',
    pemegang_hak: '',
    luas_m2: '',
    lokasi: '',
    tahun_terbit: '',
  });
  const [pnbpForm, setPnbpForm] = useState({ status_bayar: 'belum', nominal: '0' });
  const [keputusan, setKeputusan] = useState<'setujui' | 'perbaikan' | 'tolak'>('setujui');
  const [catatanKeputusan, setCatatanKeputusan] = useState('');
  const [catatanPerbaikan, setCatatanPerbaikan] = useState('');
  const [preview, setPreview] = useState<{ url: string; mime: string; nama: string } | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<PermohonanDetail>(`/permohonan/${id}`);
      setDetail(data);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat permohonan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const permohonanId = detail?.permohonan.id;
  const status = detail?.permohonan.status;

  useEffect(() => {
    if (!detail) return;
    const a = detail.sertipikat_analog;
    setAnalogForm({
      jenis_hak: a?.jenis_hak ?? detail.permohonan.jenis_hak ?? '',
      nomor_hak: a?.nomor_hak ?? detail.permohonan.nomor_hak ?? '',
      pemegang_hak: a?.pemegang_hak ?? '',
      luas_m2: a?.luas_m2 ? String(a.luas_m2) : '',
      lokasi: a?.lokasi ?? detail.permohonan.lokasi ?? '',
      tahun_terbit: a?.tahun_terbit ? String(a.tahun_terbit) : '',
    });
    setPnbpForm({
      status_bayar: detail.pnbp?.status_bayar ?? 'belum',
      nominal: String(detail.pnbp?.nominal ?? 0),
    });
    setSerahForm({
      ktp_cocok: a?.ktp_cocok ?? false,
      kk_cocok: a?.kk_cocok ?? false,
      berita_acara: '',
    });
    setCatatanKeputusan('');
    setCatatanPerbaikan('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permohonanId, status]);

  const dokumenKunci = useMemo(
    () => (detail?.dokumen ?? []).map((d) => `${d.id}:${d.checksum_sha256}`).join('|'),
    [detail?.dokumen]
  );

  useEffect(() => {
    if (!detail) return;
    const scan =
      detail.dokumen.find((d) => d.jenis === 'scan_sertipikat') ??
      detail.dokumen.find((d) => d.jenis === 'foto_sertipikat');
    if (!scan) {
      setScanUrl(null);
      return;
    }
    let active = true;
    let url: string | undefined;
    apiBlob(`/dokumen/${scan.id}`)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setScanUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokumenKunci]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (loading) return <Spinner />;
  if (!detail || !user) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Permohonan tidak dapat ditampilkan"
          description={error || 'Data tidak ditemukan atau Anda tidak memiliki akses.'}
          action={
            <Link to="/permohonan" className="btn-secondary">
              Kembali
            </Link>
          }
        />
      </div>
    );
  }

  const p = detail.permohonan;
  const analog = detail.sertipikat_analog;
  const kel = detail.kelengkapan;
  const cert = detail.sertipikat_elektronik;
  const isMasyarakat = user.role === 'masyarakat';
  const isLoket = user.role === 'loket';
  const isVerifikasi = user.role === 'verifikasi';
  const isOwner = p.pemohon_id === user.id;
  const canUploadMasyarakat = isMasyarakat && (status === 'Diajukan' || status === 'Perlu perbaikan');
  const canEditAnalog = isLoket && (status === 'Diajukan' || status === 'Berkas diterima');

  const dokumenByJenis = (jenis: string) => detail.dokumen.filter((d) => d.jenis === jenis);

  async function upload(jenis: string, file: File | undefined) {
    if (!file) return;
    setUploading(jenis);
    try {
      const fd = new FormData();
      fd.append('jenis', jenis);
      fd.append('file', file);
      await api(`/permohonan/${p.id}/dokumen`, { method: 'POST', form: fd });
      notify(`Berkas ${jenisDokumenLabel[jenis] ?? jenis} berhasil diunggah.`, 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal mengunggah berkas.', 'error');
    } finally {
      setUploading(null);
    }
  }

  async function openPreview(doc: Dokumen) {
    try {
      const blob = await apiBlob(`/dokumen/${doc.id}`);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(blob), mime: doc.mime, nama: doc.nama_asli });
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal membuka pratinjau.', 'error');
    }
  }

  async function simpanSerahTerima(e: React.FormEvent) {
    e.preventDefault();
    setSerahBusy(true);
    try {
      await api(`/permohonan/${p.id}/serah-terima`, { method: 'POST', body: serahForm });
      notify('Serah terima sertipikat asli dicatat.', 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal mencatat serah terima.', 'error');
    } finally {
      setSerahBusy(false);
    }
  }

  async function simpanAnalog(e: React.FormEvent) {
    e.preventDefault();
    setAnalogBusy(true);
    try {
      await api(`/permohonan/${p.id}/sertipikat-analog`, {
        method: 'PUT',
        body: {
          jenis_hak: analogForm.jenis_hak,
          nomor_hak: analogForm.nomor_hak,
          pemegang_hak: analogForm.pemegang_hak,
          luas_m2: Number(analogForm.luas_m2),
          lokasi: analogForm.lokasi,
          tahun_terbit: Number(analogForm.tahun_terbit),
        },
      });
      notify('Data sertipikat analog disimpan.', 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal menyimpan data.', 'error');
    } finally {
      setAnalogBusy(false);
    }
  }

  async function simpanPNBP(e: React.FormEvent) {
    e.preventDefault();
    setPnbpBusy(true);
    try {
      await api(`/permohonan/${p.id}/pnbp`, {
        method: 'POST',
        body: {
          status_bayar: pnbpForm.status_bayar,
          nominal: Number(pnbpForm.nominal),
        },
      });
      notify('Status PNBP dicatat (simulasi).', 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal mencatat PNBP.', 'error');
    } finally {
      setPnbpBusy(false);
    }
  }

  async function ajukanValidasi() {
    setValidasiBusy(true);
    try {
      await api(`/permohonan/${p.id}/ajukan-validasi`, {
        method: 'POST',
        body: { catatan: 'Berkas lengkap, diajukan ke petugas verifikasi' },
      });
      notify('Permohonan diajukan ke antrean validasi.', 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal mengajukan validasi.', 'error');
    } finally {
      setValidasiBusy(false);
    }
  }

  async function simpanKeputusan(e: React.FormEvent) {
    e.preventDefault();
    if (!catatanKeputusan.trim()) {
      notify('Catatan keputusan wajib diisi.', 'error');
      return;
    }
    setKeputusanBusy(true);
    try {
      await api(`/permohonan/${p.id}/keputusan`, {
        method: 'POST',
        body: { keputusan, catatan: catatanKeputusan.trim() },
      });
      notify(
        keputusan === 'setujui'
          ? 'Permohonan disetujui dan draf sertipikat elektronik diterbitkan.'
          : keputusan === 'perbaikan'
            ? 'Permohonan dikembalikan untuk perbaikan.'
            : 'Permohonan ditolak.',
        'success'
      );
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal menyimpan keputusan.', 'error');
    } finally {
      setKeputusanBusy(false);
    }
  }

  async function kirimPerbaikan(e: React.FormEvent) {
    e.preventDefault();
    if (!catatanPerbaikan.trim()) {
      notify('Jelaskan perbaikan yang sudah dilakukan.', 'error');
      return;
    }
    setPerbaikanBusy(true);
    try {
      await api(`/permohonan/${p.id}/kirim-perbaikan`, {
        method: 'POST',
        body: { catatan: catatanPerbaikan.trim() },
      });
      notify('Perbaikan dikirim untuk divalidasi ulang.', 'success');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Gagal mengirim perbaikan.', 'error');
    } finally {
      setPerbaikanBusy(false);
    }
  }

  function unduhSertipikat() {
    if (!cert) return;
    downloadFile(
      `/permohonan/${p.id}/sertipikat-elektronik.pdf`,
      `draf-sertipikat-${cert.kode_verifikasi}.pdf`
    ).catch((err) => notify(err.message, 'error'));
  }

  const canAjukanValidasi = kel.lengkap && kel.data_analog_lengkap;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        to="/permohonan"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar
      </Link>

      {location.state?.baru && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Permohonan berhasil dibuat. Lengkapi berkas persyaratan pada kartu <b>Dokumen</b> di bawah,
          lalu serahkan sertipikat asli ke loket.
        </div>
      )}

      <header className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-900">{p.nomor_tiket}</span>
              <StatusBadge status={p.status} />
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900">
              {p.jenis_hak} {p.nomor_hak}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {p.lokasi} · diajukan {formatDateTime(p.dibuat_pada)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cert && (
              <button type="button" onClick={unduhSertipikat} className="btn-primary">
                <Download className="h-4 w-4" />
                Unduh draf sertipikat
              </button>
            )}
            {cert && (
              <Link to={`/verifikasi/${cert.kode_verifikasi}`} className="btn-secondary">
                <QrCode className="h-4 w-4" />
                Cek keaslian
              </Link>
            )}
          </div>
        </div>

        {p.catatan && (p.status === 'Perlu perbaikan' || p.status === 'Ditolak') && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${
              p.status === 'Perlu perbaikan'
                ? 'border-orange-200 bg-orange-50 text-orange-900'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <p className="font-semibold">
              {p.status === 'Perlu perbaikan' ? 'Catatan perbaikan' : 'Alasan penolakan'}
            </p>
            <p className="mt-0.5">{p.catatan}</p>
          </div>
        )}

        {canUploadMasyarakat && kel.kurang.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Berkas belum lengkap:{' '}
              <b>{kel.kurang.map((j) => jenisDokumenLabel[j] ?? j).join(', ')}</b>. Unggah pada kartu
              Dokumen.
            </span>
          </div>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Data pemohon">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nama pemohon"
                value={
                  p.jenis_pemohon === 'badan_hukum' ? p.nama_badan_hukum : p.nama_pemohon
                }
              />
              <Field label="Jenis pemohon" value={p.jenis_pemohon === 'badan_hukum' ? 'Badan hukum' : 'Perorangan'} />
              <Field label="NIK" value={p.nik ? (isOwner || !isMasyarakat ? p.nik : maskNIK(p.nik)) : '-'} />
              <Field label="No. HP" value={p.no_hp} />
              <Field label="Email akun" value={detail.pemohon.email} />
              <Field label="Dikuasakan" value={p.dikuasakan ? 'Ya, dengan surat kuasa' : 'Tidak'} />
              <div className="sm:col-span-2">
                <Field label="Alamat" value={p.alamat} />
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            title="Data sertipikat analog"
            description={
              canEditAnalog
                ? 'Loket dapat melengkapi data ini sebelum diajukan ke validasi.'
                : 'Data yang dicocokkan petugas verifikasi dengan buku tanah dan warkah.'
            }
            action={
              analog?.serah_terima_pada ? (
                <span className="badge bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Warkah diterima
                </span>
              ) : undefined
            }
          >
            {canEditAnalog ? (
              <form onSubmit={simpanAnalog} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Jenis hak</label>
                  <input
                    className="input"
                    value={analogForm.jenis_hak}
                    onChange={(e) => setAnalogForm({ ...analogForm, jenis_hak: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Nomor hak</label>
                  <input
                    className="input"
                    value={analogForm.nomor_hak}
                    onChange={(e) => setAnalogForm({ ...analogForm, nomor_hak: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Pemegang hak</label>
                  <input
                    className="input"
                    value={analogForm.pemegang_hak}
                    onChange={(e) => setAnalogForm({ ...analogForm, pemegang_hak: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Luas (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input"
                    value={analogForm.luas_m2}
                    onChange={(e) => setAnalogForm({ ...analogForm, luas_m2: e.target.value })}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Lokasi</label>
                  <input
                    className="input"
                    value={analogForm.lokasi}
                    onChange={(e) => setAnalogForm({ ...analogForm, lokasi: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Tahun terbit</label>
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    className="input"
                    value={analogForm.tahun_terbit}
                    onChange={(e) => setAnalogForm({ ...analogForm, tahun_terbit: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={analogBusy} className="btn-primary w-full">
                    {analogBusy ? 'Menyimpan...' : 'Simpan data sertipikat'}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis hak" value={analog?.jenis_hak} />
                <Field label="Nomor hak" value={analog?.nomor_hak} />
                <Field label="Pemegang hak" value={analog?.pemegang_hak} />
                <Field label="Luas" value={formatLuas(analog?.luas_m2)} />
                <Field label="Lokasi" value={analog?.lokasi} />
                <Field label="Tahun terbit" value={analog?.tahun_terbit ?? '-'} />
              </dl>
            )}
          </SectionCard>

          {isVerifikasi && status === 'Menunggu validasi' && (
            <SectionCard
              id="validasi"
              title="Layar validasi"
              description="Bandingkan scan sertipikat asli dengan data input dan daftar periksa."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Scan sertipikat asli
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {scanUrl ? (
                      <img
                        src={scanUrl}
                        alt="Scan sertipikat asli"
                        className="max-h-[360px] w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-48 flex-col items-center justify-center gap-1 text-xs text-slate-400">
                        <FileText className="h-6 w-6" />
                        Belum ada scan
                      </div>
                    )}
                  </div>
                  {detail.dokumen.find((d) => d.jenis === 'scan_sertipikat') && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreview(
                          detail.dokumen.find((d) => d.jenis === 'scan_sertipikat') as Dokumen
                        )
                      }
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Buka ukuran penuh
                    </button>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Data input
                  </p>
                  <dl className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <Field label="Jenis hak" value={analog?.jenis_hak} />
                    <Field label="Nomor hak" value={analog?.nomor_hak} />
                    <Field label="Pemegang hak" value={analog?.pemegang_hak} />
                    <Field label="Luas" value={formatLuas(analog?.luas_m2)} />
                    <Field label="Lokasi" value={analog?.lokasi} />
                    <Field label="Tahun terbit" value={analog?.tahun_terbit ?? '-'} />
                  </dl>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Daftar periksa
                </p>
                <ul className="mt-1">
                  <ChecklistRow ok={kel.lengkap} label="Dokumen persyaratan lengkap" detail={kel.kurang.length ? `Kurang: ${kel.kurang.map((j) => jenisDokumenLabel[j] ?? j).join(', ')}` : undefined} />
                  <ChecklistRow ok={kel.data_analog_lengkap} label="Data sertipikat analog lengkap" />
                  <ChecklistRow ok={kel.ktp_cocok && kel.kk_cocok} label="KTP dan KK sudah dicocokkan di loket" />
                  <ChecklistRow ok={kel.pnbp_lunas} label="PNBP lunas (simulasi)" />
                </ul>
              </div>

              <form onSubmit={simpanKeputusan} className="mt-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'setujui', label: 'Setujui', desc: 'Terbitkan draf sertipikat', icon: CheckCircle2 },
                      { value: 'perbaikan', label: 'Perlu perbaikan', desc: 'Kembalikan ke pemohon', icon: PenLine },
                      { value: 'tolak', label: 'Tolak', desc: 'Hentikan permohonan', icon: XCircle },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKeputusan(opt.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        keputusan === opt.value
                          ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <opt.icon
                        className={`h-4 w-4 ${
                          opt.value === 'tolak'
                            ? 'text-red-500'
                            : opt.value === 'perbaikan'
                              ? 'text-orange-500'
                              : 'text-emerald-600'
                        }`}
                      />
                      <p className="mt-1 text-sm font-semibold text-slate-800">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="label" htmlFor="catatanKeputusan">
                    Catatan keputusan (wajib)
                  </label>
                  <textarea
                    id="catatanKeputusan"
                    rows={3}
                    className="input resize-none"
                    value={catatanKeputusan}
                    onChange={(e) => setCatatanKeputusan(e.target.value)}
                    placeholder="Contoh: Data sesuai dengan buku tanah dan warkah."
                    required
                  />
                </div>
                {kel.pnbp_lunas === false && keputusan === 'setujui' && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    PNBP belum lunas. Pelunasan harus dicatat loket sebelum persetujuan.
                  </p>
                )}
                <button type="submit" disabled={keputusanBusy} className="btn-primary mt-3">
                  {keputusanBusy ? 'Menyimpan...' : 'Simpan keputusan'}
                </button>
              </form>
            </SectionCard>
          )}

          <SectionCard
            title="Dokumen persyaratan"
            description="Berkas disimpan dengan nama acak dan checksum SHA-256."
          >
            {(canUploadMasyarakat || isLoket) && (
              <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {canUploadMasyarakat ? 'Unggah / lengkapi berkas' : 'Unggah scan sertipikat asli'}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(canUploadMasyarakat
                    ? kel.dokumen_wajib
                    : (['scan_sertipikat'] as string[])
                  ).map((jenis) => {
                    const sudah = dokumenByJenis(jenis).length > 0;
                    return (
                      <label
                        key={jenis}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-emerald-300"
                      >
                        <span>
                          <span className="block font-medium text-slate-700">
                            {jenisDokumenLabel[jenis] ?? jenis}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            JPG, PNG, atau PDF · maks 10 MB
                          </span>
                        </span>
                        {uploading === jenis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        ) : sudah ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Upload className="h-4 w-4 text-slate-400" />
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={(e) => {
                            upload(jenis, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {detail.dokumen.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada berkas yang diunggah.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {detail.dokumen.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {jenisDokumenLabel[doc.jenis] ?? doc.jenis}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {doc.nama_asli} · {formatBytes(doc.ukuran)} · SHA-256{' '}
                        <span className="font-mono">{doc.checksum_sha256.slice(0, 12)}…</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPreview(doc)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Eye className="mr-1 inline h-3.5 w-3.5" />
                        Lihat
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadFile(`/dokumen/${doc.id}?unduh=1`, doc.nama_asli).catch((err) =>
                            notify(err.message, 'error')
                          )
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Download className="mr-1 inline h-3.5 w-3.5" />
                        Unduh
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {(detail.pemohon && (isLoket || isVerifikasi || user.role === 'admin')) && (
            <SectionCard title="Pemeriksaan kelengkapan" description="Dihitung otomatis oleh sistem.">
              <ul className="grid gap-x-6 sm:grid-cols-2">
                <ChecklistRow
                  ok={kel.lengkap}
                  label="Dokumen wajib lengkap"
                  detail={
                    kel.kurang.length
                      ? `Kurang: ${kel.kurang.map((j) => jenisDokumenLabel[j] ?? j).join(', ')}`
                      : `${kel.dokumen_ada.length} berkas wajib tersedia`
                  }
                />
                <ChecklistRow ok={kel.data_analog_lengkap} label="Data sertipikat analog lengkap" />
                <ChecklistRow ok={kel.ktp_cocok && kel.kk_cocok} label="KTP dan KK cocok" />
                <ChecklistRow ok={kel.pnbp_lunas} label="PNBP lunas (simulasi)" />
              </ul>
            </SectionCard>
          )}

          {analog?.serah_terima_pada && (
            <SectionCard
              title="Warkah & berita acara serah terima"
              description="Sertipikat asli tidak dikembalikan kepada pemohon."
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Waktu serah terima" value={formatDateTime(analog.serah_terima_pada)} />
                <Field label="Status warkah" value={analog.status_warkah === 'warkah' ? 'Disimpan sebagai warkah' : analog.status_warkah} />
                <Field label="KTP cocok" value={analog.ktp_cocok ? 'Ya' : 'Belum/tidak'} />
                <Field label="KK cocok" value={analog.kk_cocok ? 'Ya' : 'Belum/tidak'} />
                <div className="sm:col-span-2">
                  <Field label="Berita acara" value={analog.berita_acara || '-'} />
                </div>
                {detail.dokumen.find((d) => d.jenis === 'scan_sertipikat') && (
                  <div className="sm:col-span-2">
                    <Field
                      label="Checksum scan sertipikat (SHA-256)"
                      value={detail.dokumen.find((d) => d.jenis === 'scan_sertipikat')?.checksum_sha256}
                      mono
                    />
                  </div>
                )}
              </dl>
            </SectionCard>
          )}
        </div>

        <aside className="space-y-5">
          {(isMasyarakat || isLoket) && (
            <SectionCard title="Tindakan">
              {isMasyarakat && status === 'Perlu perbaikan' && (
                <form onSubmit={kirimPerbaikan} className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Setelah mengunggah berkas perbaikan, kirim catatan perbaikan agar permohonan
                    divalidasi ulang.
                  </p>
                  <textarea
                    rows={3}
                    className="input resize-none"
                    placeholder="Contoh: Foto sertipikat sudah diunggah ulang 300 dpi."
                    value={catatanPerbaikan}
                    onChange={(e) => setCatatanPerbaikan(e.target.value)}
                  />
                  <button type="submit" disabled={perbaikanBusy} className="btn-primary w-full">
                    <Send className="h-4 w-4" />
                    {perbaikanBusy ? 'Mengirim...' : 'Kirim perbaikan'}
                  </button>
                </form>
              )}

              {isMasyarakat && (status === 'Diajukan' || status === 'Perlu perbaikan') && (
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  Unggah berkas pada kartu <b>Dokumen persyaratan</b>. Setelah lengkap, bawa
                  sertipikat asli ke loket untuk dicatat.
                </div>
              )}

              {isMasyarakat && status !== 'Diajukan' && status !== 'Perlu perbaikan' && (
                <p className="text-sm text-slate-600">
                  Tidak ada tindakan yang diperlukan. Pantau riwayat status di samping.
                </p>
              )}

              {isLoket && status === 'Diajukan' && (
                <form onSubmit={simpanSerahTerima} className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Catat serah terima sertipikat asli
                  </p>
                  <label className="flex items-start gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={serahForm.ktp_cocok}
                      onChange={(e) => setSerahForm({ ...serahForm, ktp_cocok: e.target.checked })}
                    />
                    KTP pemohon sesuai dengan dokumen
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={serahForm.kk_cocok}
                      onChange={(e) => setSerahForm({ ...serahForm, kk_cocok: e.target.checked })}
                    />
                    KK sesuai dengan dokumen
                  </label>
                  <textarea
                    rows={3}
                    className="input resize-none"
                    placeholder="Catatan berita acara serah terima (opsional)"
                    value={serahForm.berita_acara}
                    onChange={(e) => setSerahForm({ ...serahForm, berita_acara: e.target.value })}
                  />
                  <button type="submit" disabled={serahBusy} className="btn-primary w-full">
                    <ClipboardCheck className="h-4 w-4" />
                    {serahBusy ? 'Menyimpan...' : 'Catat serah terima'}
                  </button>
                </form>
              )}

              {isLoket && status === 'Berkas diterima' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Lengkapi data sertipikat analog, unggah scan, dan catat PNBP sebelum mengajukan
                    validasi.
                  </p>
                  <ul className="space-y-1 text-xs">
                    <ChecklistRow ok={kel.lengkap} label="Berkas persyaratan lengkap" />
                    <ChecklistRow ok={kel.data_analog_lengkap} label="Data analog lengkap" />
                    <ChecklistRow ok={kel.pnbp_lunas} label="PNBP lunas" />
                  </ul>
                  <button
                    type="button"
                    disabled={!canAjukanValidasi || validasiBusy}
                    onClick={ajukanValidasi}
                    className="btn-primary w-full"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {validasiBusy ? 'Mengirim...' : 'Ajukan ke validasi'}
                  </button>
                  {!canAjukanValidasi && (
                    <p className="text-[11px] text-orange-700">
                      Lengkapi berkas dan data analog terlebih dahulu.
                    </p>
                  )}
                </div>
              )}

              {isLoket && status !== 'Diajukan' && status !== 'Berkas diterima' && (
                <p className="text-sm text-slate-600">
                  Permohonan sudah diteruskan. Data tidak dapat diubah lagi agar jejak audit tetap
                  terjaga.
                </p>
              )}
            </SectionCard>
          )}

          {isVerifikasi && status !== 'Menunggu validasi' && (
            <SectionCard title="Tindakan">
              <p className="text-sm text-slate-600">
                {status === 'Terbit (simulasi)' || status === 'Ditolak'
                  ? 'Permohonan ini sudah diputuskan. Tidak ada tindakan lanjutan.'
                  : 'Keputusan hanya dapat diberikan saat status Menunggu validasi.'}
              </p>
            </SectionCard>
          )}

          <SectionCard title="PNBP (simulasi)">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Status bayar</span>
                {detail.pnbp?.status_bayar === 'lunas' ? (
                  <span className="badge bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Lunas
                  </span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800">Belum lunas</span>
                )}
              </div>
              <dl className="space-y-2">
                <Field label="Nominal" value={formatRupiah(detail.pnbp?.nominal ?? 0)} />
                <Field label="Dicatat pada" value={formatDateTime(detail.pnbp?.dicatat_pada)} />
              </dl>
              {isLoket && (
                <form onSubmit={simpanPNBP} className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="input"
                        value={pnbpForm.status_bayar}
                        onChange={(e) => setPnbpForm({ ...pnbpForm, status_bayar: e.target.value })}
                      >
                        <option value="belum">Belum</option>
                        <option value="lunas">Lunas</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Nominal (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={pnbpForm.nominal}
                        onChange={(e) => setPnbpForm({ ...pnbpForm, nominal: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={pnbpBusy} className="btn-secondary w-full">
                    {pnbpBusy ? 'Menyimpan...' : 'Simpan status PNBP'}
                  </button>
                </form>
              )}
            </div>
          </SectionCard>

          {cert ? (
            <SectionCard title="Draf sertipikat elektronik">
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <QrCode className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Dokumen simulasi dengan QR verifikasi. Bukan sertipikat elektronik resmi.</span>
                </div>
                <dl className="space-y-2">
                  <Field label="Nomor" value={cert.nomor} />
                  <Field label="Edisi" value={cert.edisi} />
                  <Field label="Kode verifikasi" value={cert.kode_verifikasi} mono />
                  <Field label="Tanggal terbit" value={formatDateTime(cert.tanggal_terbit)} />
                  <Field label="Hash SHA-256" value={`${cert.hash_dokumen.slice(0, 32)}…`} mono />
                </dl>
                <button type="button" onClick={unduhSertipikat} className="btn-primary w-full">
                  <Download className="h-4 w-4" />
                  Unduh PDF draf
                </button>
                <Link to={`/verifikasi/${cert.kode_verifikasi}`} className="btn-secondary w-full">
                  <Link2 className="h-4 w-4" />
                  Halaman verifikasi
                </Link>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Draf sertipikat elektronik">
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                Draf sertipikat elektronik akan terbit otomatis setelah permohonan disetujui.
              </div>
            </SectionCard>
          )}

          <SectionCard title="Riwayat status">
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {detail.riwayat.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                  <p className="text-sm font-semibold text-slate-800">{r.ke_status}</p>
                  <p className="text-xs text-slate-500">
                    {r.oleh_nama} · {formatDateTime(r.waktu)}
                  </p>
                  {r.catatan && <p className="mt-1 text-xs text-slate-600">{r.catatan}</p>}
                </li>
              ))}
            </ol>
          </SectionCard>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Simulasi
            </div>
            Semua data fiktif. Jangan gunakan dokumen ini sebagai bukti kepemilikan tanah.
          </div>
        </aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{preview.nama}</p>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-3">
              {preview.mime.startsWith('image/') ? (
                <img src={preview.url} alt={preview.nama} className="mx-auto max-h-[75vh]" />
              ) : (
                <iframe title={preview.nama} src={preview.url} className="h-[75vh] w-full rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
