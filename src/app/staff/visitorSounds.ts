import { useEffect, useRef, useState } from 'react';
import { playSound, preloadSounds } from 'react-sounds';
import { useVisitorStore } from '../../store/visitorStore';
import type { Visitor } from '../../types';

/**
 * Sounds on the front desk screen when someone arrives or leaves.
 *
 * Driven by the visitor store, which the realtime subscription keeps current, so
 * a check-in or check-out at any tablet plays on every open front desk screen.
 * The initial load is not treated as a flood of arrivals: sounds start only
 * after the first list has landed.
 *
 * The two sound files are served from this app (public/sounds), not from the
 * sound library's CDN. That CDN is in San Francisco and repeatedly timed out
 * from Riyadh, so in production the sound often never downloaded.
 */

export const ARRIVAL_SOUND = 'notification/success';
export const DEPARTURE_SOUND = 'system/device_disconnect';

function statuses(visitors: readonly Visitor[]): Map<string, Visitor['status']> {
  return new Map(visitors.map((v) => [v.id, v.status]));
}

export function useVisitorSounds(enabled: boolean): void {
  // Read through a ref so toggling sound does not resubscribe and lose the
  // previous snapshot, which would replay every visit as an arrival.
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Fetch both files up front, so the first arrival plays immediately.
  useEffect(() => {
    void preloadSounds([ARRIVAL_SOUND, DEPARTURE_SOUND]).catch(() => {});
  }, []);

  useEffect(() => {
    const initial = useVisitorStore.getState();
    let previous = initial.loaded ? statuses(initial.visitors) : null;

    return useVisitorStore.subscribe((state) => {
      if (!state.loaded) return;
      const next = statuses(state.visitors);

      if (previous && enabledRef.current) {
        let arrived = false;
        let departed = false;
        for (const [id, status] of next) {
          const before = previous.get(id);
          if (before === undefined && status === 'active') arrived = true;
          else if (before === 'active' && status === 'exited') departed = true;
        }
        // An arrival is the more useful thing to hear if both happen at once.
        if (arrived) void playSound(ARRIVAL_SOUND).catch(() => {});
        else if (departed) void playSound(DEPARTURE_SOUND).catch(() => {});
      }

      previous = next;
    });
  }, []);
}

type NavigatorWithActivation = Navigator & { userActivation?: { hasBeenActive: boolean } };

/**
 * Whether the browser will let this page play sound yet.
 *
 * Browsers block audio until the person has clicked or typed on the page. A
 * front desk screen that was reloaded, or opened already signed in, has not,
 * so the first arrivals would be silent with no sign why. The screen shows a
 * prompt while this is false.
 */
export function useAudioUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    const activation = (navigator as NavigatorWithActivation).userActivation;
    return activation ? activation.hasBeenActive : true;
  });

  useEffect(() => {
    if (unlocked) return;
    const unlock = () => setUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [unlocked]);

  return unlocked;
}
