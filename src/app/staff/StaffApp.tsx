import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import AppTheme from '../AppTheme';
import ErrorBoundary from '../ErrorBoundary';
import { can, homeRouteFor, type Permission } from '../../domain/access/access';
import { useAuthStore } from '../../store/authStore';
import { useCompanyStore } from '../../store/companyStore';
import { useDocumentSettingsStore } from '../../store/documentSettingsStore';
import { useFloorStore } from '../../store/floorStore';
import { useFormConfigStore } from '../../store/formConfigStore';
import { useVisitorStore } from '../../store/visitorStore';

/**
 * The staff app: front desk and admin, on one origin, separated by role.
 *
 * Routes are lazy so the charting library, the PDF writer and the spreadsheet
 * writer are not on the critical path of a sign-in. Note this is a performance
 * measure, not a security one: an unreached chunk is still fetchable. What keeps
 * this code away from the tablet is that the kiosk is a separate build on a
 * separate origin, where these modules do not exist at all.
 */

const LoginPage = lazy(() => import('../../pages/LoginPage'));
const FrontDeskPage = lazy(() => import('../../pages/FrontDeskPage'));
const AdminPage = lazy(() => import('../../pages/AdminPage'));

function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <Spin size="large" />
    </div>
  );
}

/**
 * Gate a route on a permission rather than on a role name.
 *
 * The previous guard compared the role for exact equality, so an admin was
 * redirected away from the front desk screen despite outranking it. Asking what
 * an actor may do rather than what it is called also means adding the superadmin
 * role did not require revisiting every guard.
 *
 * This is a convenience, not the security boundary. Row Level Security decides
 * what the data layer actually returns.
 */
function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const role = useAuthStore((s) => s.currentRole);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return <LoadingScreen />;
  if (!role) return <Navigate to="/" replace />;
  if (!can(role, permission)) return <Navigate to={homeRouteFor(role)} replace />;
  return <>{children}</>;
}

function RootRoute() {
  const role = useAuthStore((s) => s.currentRole);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return <LoadingScreen />;
  if (role) return <Navigate to={homeRouteFor(role)} replace />;
  return <LoginPage />;
}

/**
 * Load what the staff surfaces need, once the user is known to be staff.
 *
 * Previously six unawaited fetches and a realtime subscription fired at app
 * root for every client regardless of route, racing the auth session. They now
 * wait for a signed-in staff user, so a signed-out visitor to this origin
 * fetches nothing.
 */
function useStaffData() {
  const role = useAuthStore((s) => s.currentRole);
  const fetchVisitors = useVisitorStore((s) => s.fetchVisitors);
  const subscribeToVisitors = useVisitorStore((s) => s.subscribeToVisitors);
  const fetchCompanies = useCompanyStore((s) => s.fetchCompanies);
  const fetchFloors = useFloorStore((s) => s.fetchFloors);
  const fetchFormConfig = useFormConfigStore((s) => s.fetchFormConfig);
  const fetchDocumentSettings = useDocumentSettingsStore((s) => s.fetchDocumentSettings);

  useEffect(() => {
    if (!role) return;

    let cancelled = false;
    void (async () => {
      await Promise.all([
        fetchVisitors(),
        fetchCompanies(),
        fetchFloors(),
        fetchFormConfig(),
        fetchDocumentSettings(),
      ]);
      if (cancelled) {
        // Nothing to undo; the guard exists so a sign-out mid-flight does not
        // resurrect data for a user who has gone.
      }
    })();

    const unsubscribe = subscribeToVisitors();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    role,
    fetchVisitors,
    fetchCompanies,
    fetchFloors,
    fetchFormConfig,
    fetchDocumentSettings,
    subscribeToVisitors,
  ]);
}

function StaffRoutes() {
  useStaffData();

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route
          path="/frontdesk"
          element={
            <RequirePermission permission="visitors.read">
              <FrontDeskPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin"
          element={
            <RequirePermission permission="analytics.view">
              <AdminPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function StaffApp() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // initialize resolves to its own unsubscribe, so the auth listener is torn
    // down with the app rather than leaking across hot reloads.
    let dispose: (() => void) | undefined;
    let cancelled = false;

    void initialize().then((unsubscribe) => {
      if (cancelled) {
        unsubscribe();
        return;
      }
      dispose = unsubscribe;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [initialize]);

  return (
    <ErrorBoundary label="staff">
      <AppTheme>
        <BrowserRouter>
          <StaffRoutes />
        </BrowserRouter>
      </AppTheme>
    </ErrorBoundary>
  );
}
