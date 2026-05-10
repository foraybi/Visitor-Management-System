import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import VisitorPage from '../pages/VisitorPage';
import FrontDeskPage from '../pages/FrontDeskPage';
import AdminPage from '../pages/AdminPage';
import LoginPage from '../pages/LoginPage';

function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { currentRole } = useAuthStore();
  if (currentRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
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
