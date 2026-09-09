import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Register the kiosk's service worker and hold any update until it is safe.
 *
 * The worker is registered with 'prompt' rather than 'autoUpdate', so a new
 * build waits instead of reloading the page the moment it lands. On a kiosk an
 * automatic reload means reloading in the middle of somebody's check-in, losing
 * whatever they had typed and leaving them staring at a fresh form.
 *
 * The update is applied only when the caller says the tablet is idle, which in
 * practice is when it is sitting on the welcome screen with nobody in front of
 * it.
 *
 * Written against the plain service worker API rather than the plugin's virtual
 * module, so this file has no build-time dependency on the PWA plugin being
 * present. The staff build has no service worker and never imports this.
 */
export function useServiceWorkerUpdate(applyWhenIdle: boolean): { updateReady: boolean } {
  const [updateReady, setUpdateReady] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;

    const noteWaiting = (worker: ServiceWorker | null) => {
      if (cancelled || !worker) return;
      waiting.current = worker;
      setUpdateReady(true);
    };

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;

        noteWaiting(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // 'installed' with an existing controller means a newer build is
            // ready and waiting behind the one currently running.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              noteWaiting(reg.waiting ?? installing);
            }
          });
        });
      })
      .catch((cause) => {
        // A tablet without a service worker still works; it just loses the
        // cached shell. Not worth failing the app over.
        console.warn('service worker registration failed:', cause);
      });

    // The tablet stays open for weeks, so poll rather than relying on a reload
    // to discover a new build.
    const poll = window.setInterval(() => void registration?.update(), 60 * 60 * 1000);

    // Reload once the new worker takes over, not before.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const apply = useCallback(() => {
    waiting.current?.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  useEffect(() => {
    if (updateReady && applyWhenIdle) apply();
  }, [updateReady, applyWhenIdle, apply]);

  return { updateReady };
}
