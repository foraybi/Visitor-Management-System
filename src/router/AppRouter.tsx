import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import VisitorPage from '../pages/VisitorPage';
import FrontDeskPage from '../pages/FrontDeskPage';
import AdminPage from '../pages/AdminPage';
import LoginPage from '../pages/LoginPage';

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}

function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const currentRole = useAuthStore(s => s.currentRole);
  const isLoading = useAuthStore(s => s.isLoading);
  if (isLoading) return <LoadingScreen />;
  if (currentRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRoute() {
  const currentRole = useAuthStore(s => s.currentRole);
  const isLoading = useAuthStore(s => s.isLoading);
  if (isLoading) return <LoadingScreen />;
  if (currentRole === 'visitor') return <Navigate to="/visitor" replace />;
  if (currentRole === 'frontdesk') return <Navigate to="/frontdesk" replace />;
  if (currentRole === 'admin') return <Navigate to="/admin" replace />;
  return <LoginPage />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/visitor" element={<VisitorPage />} />
        <Route
          path="/frontdesk"
          element={
            <ProtectedRoute role="frontdesk">
              <FrontDeskPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
