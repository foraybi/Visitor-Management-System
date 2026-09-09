import { create } from 'zustand';
import type { FloorInfo } from '../types';
import { generateId } from '../utils/idGenerator';
import { persist } from '../data/persist';
import { supabase, toFloor, fromFloor } from '../lib/supabase';

interface FloorState {
  floors: FloorInfo[];
  loaded: boolean;
  fetchFloors: () => Promise<void>;
  addFloor: (data: Omit<FloorInfo, 'id'>) => void;
  updateFloor: (id: string, data: Partial<FloorInfo>) => void;
  deleteFloor: (id: string) => void;
  seedDefaults: () => void;
}

export const useFloorStore = create<FloorState>()((set, get) => ({
  floors: [],
  loaded: false,

  fetchFloors: async () => {
    const { data, error } = await supabase
      .from('floors')
      .select('*')
      .order('number');
    if (error) {
      console.error('Failed to fetch floors:', error);
      return;
    }
    set({ floors: (data ?? []).map(toFloor), loaded: true });
  },

  addFloor: (data) => {
    const id = generateId();
    const floor: FloorInfo = { ...data, id };
    const previous = get().floors;
    set(state => ({ floors: [...state.floors, floor] }));
    void persist(
      'floor.add',
      () => supabase.from('floors').insert(fromFloor(floor)),
      () => set({ floors: previous }),
    );
  },

  updateFloor: (id, data) => {
    const previous = get().floors;
    set(state => ({
      floors: state.floors.map(f => (f.id === id ? { ...f, ...data } : f)),
    }));
    const row: Record<string, unknown> = {};
    if (data.number !== undefined) row.number = data.number;
    if (data.name !== undefined) row.name = data.name;
    if (data.nameAr !== undefined) row.name_ar = data.nameAr;
    if (data.imageUrl !== undefined) row.image_url = data.imageUrl || null;
    if (Object.keys(row).length > 0) {
      void persist(
        'floor.update',
        () => supabase.from('floors').update(row).eq('id', id),
        () => set({ floors: previous }),
      );
    }
  },

  deleteFloor: (id) => {
    const previous = get().floors;
    set(state => ({ floors: state.floors.filter(f => f.id !== id) }));
    void persist(
      'floor.delete',
      () => supabase.from('floors').delete().eq('id', id),
      () => set({ floors: previous }),
    );
  },

  seedDefaults: () => {
    if (get().floors.length > 0) return;
    const defaults: FloorInfo[] = [
      { id: generateId(), number: 1, name: 'Ground Floor', nameAr: 'الطابق الأرضي', imageUrl: '' },
      { id: generateId(), number: 2, name: 'Second Floor', nameAr: 'الطابق الثاني', imageUrl: '' },
      { id: generateId(), number: 3, name: 'Third Floor', nameAr: 'الطابق الثالث', imageUrl: '' },
    ];
    set({ floors: defaults });
    void persist(
      'floor.seed',
      () => supabase.from('floors').insert(defaults.map(fromFloor)),
      () => set({ floors: [] }),
    );
  },
}));
