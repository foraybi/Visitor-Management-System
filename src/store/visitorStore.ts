import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Visitor, VisitorState, EnterFormData } from '../types';
import { generateVisitorId } from '../utils/idGenerator';
import { getCurrentTimestamp, getTodayDateString } from '../utils/timeUtils';
import { getCountryLabel } from '../utils/countryData';

export const useVisitorStore = create<VisitorState>()(
  persist(
    (set, get) => ({
      visitors: [],

      addVisitor: (data: EnterFormData) => {
        const existingIds = get().visitors.map(v => v.id);
        const newId = generateVisitorId(existingIds);
        // Store the English name as canonical; display can localize later
        const newVisitor: Visitor = {
          ...data,
          id: newId,
          countryName: getCountryLabel(data.countryCode, 'en'),
          entryTime: getCurrentTimestamp(),
          exitTime: null,
          status: 'active',
          date: getTodayDateString(),
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
    { name: 'vms-visitors' }
  )
);
