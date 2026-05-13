import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Visitor, VisitorState, EnterFormData } from '../types';
import { generateVisitorId } from '../utils/idGenerator';
import { getCurrentTimestamp, getTodayDateString } from '../utils/timeUtils';
import { getCountryLabel } from '../utils/countryData';

export const useVisitorStore = create<VisitorState>()(
  persist(
    (set, get) => ({
      visitors: [],

      addVisitor: (data: EnterFormData) => {
        const today = getTodayDateString();
        const existing = get().visitors.map(v => ({ id: v.id, date: v.date }));
        const newId = generateVisitorId(existing, today);
        const newVisitor: Visitor = {
          ...data,
          id: newId,
          countryName: getCountryLabel(data.countryCode, 'en'),
          entryTime: getCurrentTimestamp(),
          exitTime: null,
          status: 'active',
          date: today,
        };
        set(state => ({ visitors: [...state.visitors, newVisitor] }));
        return newId;
      },

      exitVisitor: (id: string) => {
        const visitor = get().visitors.find(v => v.id === id);
        if (!visitor || visitor.status === 'exited') return false;
        set(state => ({
          visitors: state.visitors.map(v =>
            v.id === id
              ? { ...v, exitTime: getCurrentTimestamp(), status: 'exited' }
              : v
          ),
        }));
        return true;
      },

      getVisitorById: (id: string) => {
        return get().visitors.find(v => v.id === id);
      },

      getTodayVisitors: () => {
        const today = getTodayDateString();
        return get().visitors.filter(v => v.date === today);
      },

      getActiveVisitors: () => {
        return get().visitors.filter(v => v.status === 'active');
      },
    }),
    {
      name: 'vms-visitors',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Cross-tab sync: when another tab/window updates the visitors in localStorage,
// re-hydrate this tab's store so Front Desk / Admin see new entries live.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'vms-visitors' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.state?.visitors) {
          useVisitorStore.setState({ visitors: parsed.state.visitors });
        }
      } catch {
        // ignore parse errors
      }
    }
  });
}
