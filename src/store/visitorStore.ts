import { create } from 'zustand';
import type { VisitorState } from '../types';
import { getCurrentTimestamp, getTodayDateString } from '../utils/timeUtils';
import { persist } from '../data/persist';
import { supabase, toVisitor } from '../lib/supabase';

interface ExtendedVisitorState extends VisitorState {
  loaded: boolean;
  fetchVisitors: () => Promise<void>;
  subscribeToVisitors: () => () => void;
}

export const useVisitorStore = create<ExtendedVisitorState>()((set, get) => ({
  visitors: [],
  loaded: false,

  fetchVisitors: async () => {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .order('entry_time', { ascending: false });
    if (error) {
      console.error('Failed to fetch visitors:', error);
      return;
    }
    set({ visitors: (data ?? []).map(toVisitor), loaded: true });
  },

  subscribeToVisitors: () => {
    const channel = supabase
      .channel('visitors-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visitors' },
        (payload) => {
          const incoming = toVisitor(payload.new as Parameters<typeof toVisitor>[0]);
          set(state => {
            // Skip if already in state (optimistic update from this device)
            if (state.visitors.find(v => v.id === incoming.id)) return state;
            return { visitors: [incoming, ...state.visitors] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visitors' },
        (payload) => {
          const updated = toVisitor(payload.new as Parameters<typeof toVisitor>[0]);
          set(state => ({
            visitors: state.visitors.map(v => (v.id === updated.id ? updated : v)),
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  /*
   * addVisitor is deliberately absent.
   *
   * A visit is created only by /api/kiosk/check-in, which allocates the visit
   * code from a per-day counter in Postgres. The browser-side version counted
   * today's rows and padded to four digits, which restarted every morning
   * against a TEXT PRIMARY KEY and silently lost every visit from the second day
   * onward. There is also no insert policy for any signed-in user, so a second
   * write path here could not succeed even if one were added.
   */

  exitVisitor: (id: string) => {
    const visitor = get().visitors.find(v => v.id === id);
    if (!visitor || visitor.status === 'exited') return false;
    const exitTime = getCurrentTimestamp();
    // Optimistic update
    set(state => ({
      visitors: state.visitors.map(v =>
        v.id === id ? { ...v, exitTime, status: 'exited' } : v
      ),
    }));
    // Persist, rolling the row back to open if the update does not land. The
    // front desk must not be shown a visitor as departed when the database
    // still has them inside the building.
    const previous = get().visitors;
    void persist(
      'visitor.exit',
      () => supabase.from('visitors').update({ exit_time: exitTime, status: 'exited' }).eq('id', id),
      () => set({ visitors: previous }),
    );
    return true;
  },

  getVisitorById: (id: string) => get().visitors.find(v => v.id === id),

  getTodayVisitors: () => {
    const today = getTodayDateString();
    return get().visitors.filter(v => v.date === today);
  },

  getActiveVisitors: () => get().visitors.filter(v => v.status === 'active'),
}));
