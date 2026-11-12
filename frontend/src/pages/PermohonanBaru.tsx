import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, FileCheck2 } from 'lucide-react';
import { api, ApiError } from '../api';
import type { Permohonan } from '../types';
import { useToast } from '../toast';

const jenisHakOptions = [
  'Hak Milik',
  'Hak Guna Bangunan',
  'Hak Guna Usaha',
  'Hak Pakai',
  'Hak Milik Satuan Rumah Susun',
];

export default function PermohonanBaru() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    jenis_pemohon: 'perorangan' as 'perorangan' | 'badan_hukum',
    nama_badan_hukum: '',
    dikuasakan: false,
    nik: '',
    alamat: '',
    no_hp: '',
    jenis_hak: 'Hak Milik',
    nomor_hak: '',
    lokasi: '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const syarat = useMemo(() => {
    const items = ['KTP pemohon', 'Kartu Keluarga (KK)', 'Foto sertipikat analog'];
    if (form.dikuasakan) items.push('Surat kuasa');
    if (form.jenis_pemohon === 'badan_hukum') items.push('Akta pendirian badan hukum');
    return items;
  }, [form.dikuasakan, form.jenis_pemohon]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.jenis_pemohon === 'perorangan' && !/^\d{16}$/.test(form.nik)) {
      setError('NIK harus 16 angka.');
      return;
    }
    if (form.jenis_pemohon === 'badan_hukum' && !form.nama_badan_hukum.trim()) {
      setError('Nama badan hukum wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ permohonan: Permohonan }>('/permohonan', {
        method: 'POST',
        body: form,
      });
      notify('Permohonan berhasil dibuat. Silakan unggah persyaratan.', 'success');
      navigate(`/permohonan/${res.permohonan.id}`, { state: { baru: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat permohonan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        to="/permohonan"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar permohonan
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ajukan Alih Media</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lengkapi data pemohon dan data sertipikat analog. Setelah tersimpan, unggah berkas
          persyaratan pada halaman detail permohonan.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="card p-5">
          <h2 className="text-base font-semibold text-slate-800">Data pemohon</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(['perorangan', 'badan_hukum'] as const).map((jenis) => (
              <button
                key={jenis}
                type="button"
                onClick={() => set('jenis_pemohon', jenis)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  form.jenis_pemohon === jenis
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">
                  {jenis === 'perorangan' ? 'Perorangan' : 'Badan hukum'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {jenis === 'perorangan'
                    ? 'Sertipikat atas nama pribadi.'
                    : 'Sertipikat atas nama perusahaan atau yayasan.'}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {form.jenis_pemohon === 'badan_hukum' && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="badan">
                  Nama badan hukum
                </label>
                <input
                  id="badan"
                  required
                  className="input"
                  value={form.nama_badan_hukum}
                  onChange={(e) => set('nama_badan_hukum', e.target.value)}
                  placeholder="Contoh: PT Tanah Makmur Sejahtera"
                />
              </div>
            )}
            {form.jenis_pemohon === 'perorangan' && (
              <div>
                <label className="label" htmlFor="nik">
                  NIK (16 angka)
                </label>
                <input
                  id="nik"
                  inputMode="numeric"
                  maxLength={16}
                  required
                  className="input"
                  value={form.nik}
                  onChange={(e) => set('nik', e.target.value.replace(/\D/g, ''))}
                  placeholder="Sesuai KTP"
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="hp">
                No. HP
              </label>
              <input
                id="hp"
                required
                className="input"
                value={form.no_hp}
                onChange={(e) => set('no_hp', e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="alamat">
                Alamat pemohon
              </label>
              <textarea
                id="alamat"
                required
                rows={2}
                className="input resize-none"
                value={form.alamat}
                onChange={(e) => set('alamat', e.target.value)}
                placeholder="Alamat sesuai KTP"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
              checked={form.dikuasakan}
              onChange={(e) => set('dikuasakan', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Diajukan melalui kuasa
              </span>
              <span className="block text-xs text-slate-500">
                Wajib melampirkan surat kuasa. Penerima kuasa membawa dokumen asli ke loket.
              </span>
            </span>
          </label>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-semibold text-slate-800">Data sertipikat analog</h2>
          <p className="mt-1 text-xs text-slate-500">
            Data ini akan dicocokkan petugas dengan buku tanah dan warkah.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="jenisHak">
                Jenis hak
              </label>
              <select
                id="jenisHak"
                className="input"
                value={form.jenis_hak}
                onChange={(e) => set('jenis_hak', e.target.value)}
              >
                {jenisHakOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nomorHak">
                Nomor hak
              </label>
              <input
                id="nomorHak"
                required
                className="input"
                value={form.nomor_hak}
                onChange={(e) => set('nomor_hak', e.target.value)}
                placeholder="Contoh: 01234/Sukamaju"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="lokasi">
                Lokasi bidang tanah
              </label>
              <input
                id="lokasi"
                required
                className="input"
                value={form.lokasi}
                onChange={(e) => set('lokasi', e.target.value)}
                placeholder="Desa/Kelurahan, Kecamatan, Kabupaten/Kota"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <FileCheck2 className="h-4 w-4" />
            Persyaratan yang perlu disiapkan
          </div>
          <ul className="mt-3 grid gap-2 text-sm text-emerald-900 sm:grid-cols-2">
            {syarat.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-emerald-800/80">
            Berkas diunggah pada langkah berikutnya. Sertipikat asli tetap harus dibawa ke kantor
            pertanahan untuk dicatat sebagai warkah.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Menyimpan...' : 'Simpan & lanjut unggah berkas'}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
          <Link to="/permohonan" className="btn-secondary">
            Batal
          </Link>
        </div>
      </form>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Prototipe ini memakai data fiktif. Jangan memasukkan data pertanahan atau data pribadi yang
        sebenarnya.
      </div>
    </div>
  );
}
