import { useEffect, useRef } from 'react';

/**
 * Return the kiosk to its welcome screen after a period with no interaction.
 *
 * There was no idle handling at all. A visitor who started the form, typed their
 * national id and walked away left it on screen indefinitely for whoever
 * arrived next, in a lobby, on an unattended tablet. That is the same exposure
 * the sessionStorage draft caused, and it needs the same answer: nothing about a
 * visitor survives their leaving.
 *
 * Pointer and key events are watched, not mouse movement: a tablet has no
 * hovering pointer, and touch events are what actually indicate a person.
 */
const DEFAULT_IDLE_MS = 90_000;

export function useIdleReset(onIdle: () => void, options: { idleMs?: number; enabled?: boolean } = {}) {
  const { idleMs = DEFAULT_IDLE_MS, enabled = true } = options;

  // Held in a ref so restarting the timer on every touch does not re-subscribe
  // the listeners, and so a changing callback does not reset the countdown.
  // Assigned in an effect rather than during render, which would be a write to
  // a ref while rendering.
  const callback = useRef(onIdle);
  useEffect(() => {
    callback.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;

    let timer = window.setTimeout(() => callback.current(), idleMs);

    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), idleMs);
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ];
    for (const event of events) {
      window.addEventListener(event, restart, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, restart);
      }
    };
  }, [idleMs, enabled]);
}

/**
 * Keep the tablet's screen awake.
 *
 * A kiosk that has gone to sleep looks broken, and a visitor who has to wake it
 * usually finds a lock screen instead of the check-in form. The lock is dropped
 * whenever the page is hidden and must be re-acquired on return, which is why
 * this listens for visibility changes rather than requesting once.
 *
 * Screen Wake Lock is not available in every browser and is refused when the
 * page is not visible. Both cases are non-fatal: the tablet dims sooner.
 */
export function useScreenWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      if (released || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Refused by the browser or the platform. Nothing to recover.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
