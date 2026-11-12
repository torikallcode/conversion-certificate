import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { useAuth } from './auth';
import type { Role } from './types';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PermohonanList from './pages/PermohonanList';
import PermohonanBaru from './pages/PermohonanBaru';
import PermohonanDetailPage from './pages/PermohonanDetailPage';
import LoketQueue from './pages/LoketQueue';
import ValidasiQueue from './pages/ValidasiQueue';
import AdminUsers from './pages/AdminUsers';
import AdminAudit from './pages/AdminAudit';
import Account from './pages/Account';
import PublicVerify from './pages/PublicVerify';
import NotFound from './pages/NotFound';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/daftar" element={<Register />} />
      <Route path="/verifikasi" element={<PublicVerify />} />
      <Route path="/verifikasi/:kode" element={<PublicVerify />} />

      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="/permohonan" element={<PermohonanList />} />
        <Route
          path="/permohonan/baru"
          element={
            <RoleGate roles={['masyarakat']}>
              <PermohonanBaru />
            </RoleGate>
          }
        />
        <Route path="/permohonan/:id" element={<PermohonanDetailPage />} />
        <Route
          path="/loket"
          element={
            <RoleGate roles={['loket', 'admin']}>
              <LoketQueue />
            </RoleGate>
          }
        />
        <Route
          path="/validasi"
          element={
            <RoleGate roles={['verifikasi', 'admin']}>
              <ValidasiQueue />
            </RoleGate>
          }
        />
        <Route
          path="/admin/pengguna"
          element={
            <RoleGate roles={['admin']}>
              <AdminUsers />
            </RoleGate>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RoleGate roles={['admin']}>
              <AdminAudit />
            </RoleGate>
          }
        />
        <Route path="/akun" element={<Account />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
