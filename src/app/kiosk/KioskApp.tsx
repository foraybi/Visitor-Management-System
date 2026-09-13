import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Result } from 'antd';
import AppTheme from '../AppTheme';
import ErrorBoundary from '../ErrorBoundary';
import VisitorPage from '../../pages/VisitorPage';
import { consumeProvisioningLink } from './deviceProvisioning';
import { useKioskStore } from './kioskStore';
import { useIdleReset, useScreenWakeLock } from './useIdleReset';
import { useServiceWorkerUpdate } from './useServiceWorker';

/*
 * Runs once, when the kiosk bundle loads and before anything asks the server
 * for data, so a tablet opened from its provisioning link is registered by the
 * time the first request goes out.
 */
consumeProvisioningLink();

/**
 * Shown instead of the check-in screens when this tablet has no valid device
 * token. Previously the kiosk showed an empty company picker with no
 * explanation, which looks like a broken form rather than an unregistered
 * device.
 */
function UnregisteredTablet({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="floating-orbs"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Result
        status="warning"
        title={t('visitor.unregistered.title')}
        subTitle={t('visitor.unregistered.body')}
        extra={
          <Button type="primary" size="large" onClick={onRetry}>
            {t('visitor.unregistered.retry')}
          </Button>
        }
      />
    </div>
  );
}

/**
 * The tablet.
 *
 * There is no router, no login page and no route that reaches one. It fetches
 * nothing at boot beyond the company picker.
 */
export default function KioskApp() {
  const loadDirectory = useKioskStore((s) => s.loadDirectory);
  const directoryError = useKioskStore((s) => s.directoryError);

  /**
   * Bumping this remounts the whole visitor tree. Clearing the form field by
   * field would mean remembering every field, and the one that gets forgotten is
   * the one holding an identity number. A remount cannot miss anything.
   */
  const [sessionKey, setSessionKey] = useState(0);
  const [idle, setIdle] = useState(true);

  const resetToWelcome = useCallback(() => {
    setSessionKey((n) => n + 1);
    setIdle(true);
  }, []);

  useIdleReset(resetToWelcome);
  useScreenWakeLock();

  // A waiting update is applied only while the tablet is idle, never mid check-in.
  useServiceWorkerUpdate(idle);

  useEffect(() => {
    const onInteract = () => setIdle(false);
    window.addEventListener('pointerdown', onInteract, { passive: true });
    return () => window.removeEventListener('pointerdown', onInteract);
  }, []);

  useEffect(() => {
    void loadDirectory();

    // The tablet stays open for weeks. Refresh periodically, and whenever it
    // comes back online, so a company added during the day appears.
    const id = window.setInterval(() => void loadDirectory(), 10 * 60 * 1000);
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
        {directoryError === 'unauthorised_device' ? (
          <UnregisteredTablet onRetry={() => void loadDirectory()} />
        ) : (
          <VisitorPage key={sessionKey} />
        )}
      </AppTheme>
    </ErrorBoundary>
  );
}
