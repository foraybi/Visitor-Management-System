import { useEffect } from 'react';
import AppTheme from '../AppTheme';
import VisitorPage from '../../pages/VisitorPage';
import { useKioskStore } from './kioskStore';

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
    <AppTheme>
      <VisitorPage />
    </AppTheme>
  );
}
