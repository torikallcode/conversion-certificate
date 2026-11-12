import { Link } from 'react-router-dom';
import { AlertTriangle, Landmark } from 'lucide-react';
import { useAuth } from '../auth';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <div className="rounded-2xl bg-brand-900 p-3 text-white">
        <Landmark className="h-7 w-7" />
      </div>
      <p className="mt-5 text-5xl font-extrabold text-slate-300">404</p>
      <h1 className="mt-2 text-xl font-bold text-slate-800">Halaman tidak ditemukan</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Tautan mungkin salah atau halaman sudah dipindahkan. Kembali ke halaman utama aplikasi.
      </p>
      <div className="mt-5 flex gap-2">
        <Link to={user ? '/' : '/login'} className="btn-primary">
          {user ? 'Ke dasbor' : 'Ke halaman masuk'}
        </Link>
        <Link to="/verifikasi" className="btn-secondary">
          Cek keaslian
        </Link>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        Prototipe simulasi, bukan layanan resmi ATR/BPN.
      </p>
    </div>
  );
}
