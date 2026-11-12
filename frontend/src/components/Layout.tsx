import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  FilePlus2,
  Files,
  LayoutDashboard,
  Landmark,
  LogOut,
  Menu,
  QrCode,
  ScrollText,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../auth';
import { roleLabel } from '../utils';
import type { Role } from '../types';

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const navByRole: Record<Role, NavItem[]> = {
  masyarakat: [
    { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
    { to: '/permohonan', label: 'Permohonan Saya', icon: Files, end: true },
    { to: '/permohonan/baru', label: 'Ajukan Alih Media', icon: FilePlus2 },
    { to: '/verifikasi', label: 'Cek Keaslian', icon: QrCode },
    { to: '/akun', label: 'Akun Saya', icon: UserCircle },
  ],
  loket: [
    { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
    { to: '/loket', label: 'Antrean Loket', icon: ClipboardCheck },
    { to: '/permohonan', label: 'Semua Permohonan', icon: Files, end: true },
    { to: '/verifikasi', label: 'Cek Keaslian', icon: QrCode },
    { to: '/akun', label: 'Akun Saya', icon: UserCircle },
  ],
  verifikasi: [
    { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
    { to: '/validasi', label: 'Antrean Validasi', icon: ShieldCheck },
    { to: '/permohonan', label: 'Semua Permohonan', icon: Files, end: true },
    { to: '/verifikasi', label: 'Cek Keaslian', icon: QrCode },
    { to: '/akun', label: 'Akun Saya', icon: UserCircle },
  ],
  admin: [
    { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
    { to: '/admin/pengguna', label: 'Pengguna & Peran', icon: Users },
    { to: '/admin/audit', label: 'Log Audit', icon: ScrollText },
    { to: '/permohonan', label: 'Semua Permohonan', icon: Files, end: true },
    { to: '/verifikasi', label: 'Cek Keaslian', icon: QrCode },
    { to: '/akun', label: 'Akun Saya', icon: UserCircle },
  ],
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const items = navByRole[user.role];

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="rounded-xl bg-white/10 p-2 text-white">
          <Landmark className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Alih Media Sertipikat</p>
          <p className="text-xs text-brand-200">Prototipe ATR/BPN</p>
        </div>
      </div>

      <div className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-snug text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>SIMULASI — bukan layanan resmi ATR/BPN.</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-brand-100/80 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-900">
            {user.nama.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.nama}</p>
            <p className="text-xs text-brand-200">{roleLabel[user.role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-100/80 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-900 lg:flex">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-brand-900 shadow-2xl">
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-brand-100 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-900 sm:text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          SIMULASI, bukan sertipikat elektronik resmi — data fiktif untuk demonstrasi.
        </div>

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <Landmark className="h-5 w-5 text-brand-700" />
              <span className="truncate text-sm font-bold text-slate-800">Alih Media Sertipikat</span>
            </Link>
            <p className="hidden text-sm font-semibold text-slate-500 lg:block">
              Sistem Alih Media Sertipikat Analog ke Elektronik
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <Link
                to="/verifikasi"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:flex"
              >
                <QrCode className="h-4 w-4" />
                Cek Keaslian
              </Link>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-900">
                  {user.nama.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold text-slate-700">{user.nama}</p>
                  <p className="text-[11px] text-slate-500">{roleLabel[user.role]}</p>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 lg:px-8">
          Prototipe alih media sertipikat — hanya untuk demonstrasi. Tidak terhubung ke sistem resmi
          ATR/BPN, tidak memakai tanda tangan elektronik BSrE.
        </footer>
      </div>
    </div>
  );
}
