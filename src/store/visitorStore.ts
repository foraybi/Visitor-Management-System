import { create } from 'zustand';
import type { Visitor, VisitorState, EnterFormData } from '../types';
import { generateVisitorId } from '../utils/idGenerator';
import { getCurrentTimestamp, getTodayDateString } from '../utils/timeUtils';
import { getCountryLabel } from '../utils/countryData';
import { supabase, toVisitor, fromVisitor } from '../lib/supabase';

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
    // Optimistic update — UI is instant
    set(state => ({ visitors: [newVisitor, ...state.visitors] }));
    // Persist to Supabase — triggers realtime event on all other devices
    supabase
      .from('visitors')
      .insert(fromVisitor(newVisitor))
      .then(({ error }) => {
        if (error) console.error('Failed to insert visitor:', error);
      });
    return newId;
  },

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
    // Persist to Supabase — triggers realtime UPDATE on all other devices
    supabase
      .from('visitors')
      .update({ exit_time: exitTime, status: 'exited' })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Failed to update visitor exit:', error);
      });
    return true;
  },

  getVisitorById: (id: string) => get().visitors.find(v => v.id === id),

  getTodayVisitors: () => {
    const today = getTodayDateString();
    return get().visitors.filter(v => v.date === today);
  },

  getActiveVisitors: () => get().visitors.filter(v => v.status === 'active'),
}));
