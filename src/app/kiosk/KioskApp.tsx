import { useCallback, useEffect, useState } from 'react';
import AppTheme from '../AppTheme';
import ErrorBoundary from '../ErrorBoundary';
import VisitorPage from '../../pages/VisitorPage';
import { useKioskStore } from './kioskStore';
import { useIdleReset, useScreenWakeLock } from './useIdleReset';
import { useServiceWorkerUpdate } from './useServiceWorker';

/**
 * The tablet.
 *
 * There is no router, no login page and no route that reaches one. A visitor
 * previously met a three-card role picker offering Front Desk and Admin
 * alongside Visitor, and the hidden exit gesture navigated to that same screen.
 * In this build those screens are not merely unreachable, they are not compiled
 * in: Rollup drops the staff branch in main.tsx because the target check folds
 * to a constant.
 *
 * It also fetches nothing at boot beyond the company picker. The previous shell
 * pulled every visitor ever recorded and every employee record onto the device.
 */
export default function KioskApp() {
  const loadDirectory = useKioskStore((s) => s.loadDirectory);

  /**
   * Bumping this remounts the whole visitor tree.
   *
   * Clearing the form field by field would mean remembering every field, and
   * the one that gets forgotten is the one holding an identity number. A
   * remount cannot miss anything.
   */
  const [sessionKey, setSessionKey] = useState(0);
  const [idle, setIdle] = useState(true);

  const resetToWelcome = useCallback(() => {
    setSessionKey((n) => n + 1);
    setIdle(true);
  }, []);

  useIdleReset(resetToWelcome);
  useScreenWakeLock();

  // A waiting update is applied only while the tablet is idle, never mid
  // check-in.
  useServiceWorkerUpdate(idle);

  // Anything the visitor touches means somebody is using the tablet, so an
  // update must wait. Cleared again by the idle reset above.
  useEffect(() => {
    const onInteract = () => setIdle(false);
    window.addEventListener('pointerdown', onInteract, { passive: true });
    return () => window.removeEventListener('pointerdown', onInteract);
  }, []);

  useEffect(() => {
    void loadDirectory();

    // The tablet stays open for weeks. Refresh periodically so a company added
    // during the day appears without someone having to reload the kiosk.
    const id = window.setInterval(() => void loadDirectory(), 10 * 60 * 1000);

    // Also refresh when the tablet comes back online, so a device that spent the
    // morning disconnected is not showing yesterday's list.
    const onOnline = () => void loadDirectory();
    window.addEventListener('online', onOnline);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [loadDirectory]);

  return (
    <ErrorBoundary label="kiosk" autoReloadMs={8000}>
      <AppTheme>
        <VisitorPage key={sessionKey} />
      </AppTheme>
    </ErrorBoundary>
  );
}
