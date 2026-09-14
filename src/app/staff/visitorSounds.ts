import { useEffect, useRef } from 'react';
import { playSound } from 'react-sounds';
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
 * Browsers keep audio locked until the page has been interacted with. The sound
 * library's audio engine unlocks itself on the first tap or key press, which a
 * signed-in front desk user has always made.
 */

const ARRIVAL = 'notification/success';
const DEPARTURE = 'system/device_disconnect';

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
        if (arrived) void playSound(ARRIVAL).catch(() => {});
        else if (departed) void playSound(DEPARTURE).catch(() => {});
      }

      previous = next;
    });
  }, []);
}
