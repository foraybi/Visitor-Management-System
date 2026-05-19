import { create } from 'zustand';
import type { FloorInfo } from '../types';
import { generateId } from '../utils/idGenerator';
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
    set(state => ({ floors: [...state.floors, floor] }));
    supabase
      .from('floors')
      .insert(fromFloor(floor))
      .then(({ error }) => {
        if (error) console.error('Failed to insert floor:', error);
      });
  },

  updateFloor: (id, data) => {
    set(state => ({
      floors: state.floors.map(f => (f.id === id ? { ...f, ...data } : f)),
    }));
    const row: Record<string, unknown> = {};
    if (data.number !== undefined) row.number = data.number;
    if (data.name !== undefined) row.name = data.name;
    if (data.nameAr !== undefined) row.name_ar = data.nameAr;
    if (data.imageUrl !== undefined) row.image_url = data.imageUrl || null;
    if (Object.keys(row).length > 0) {
      supabase
        .from('floors')
        .update(row)
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update floor:', error);
        });
    }
  },

  deleteFloor: (id) => {
    set(state => ({ floors: state.floors.filter(f => f.id !== id) }));
    supabase
      .from('floors')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Failed to delete floor:', error);
      });
  },

  seedDefaults: () => {
    if (get().floors.length > 0) return;
    const defaults: FloorInfo[] = [
      { id: generateId(), number: 1, name: 'Ground Floor', nameAr: 'الطابق الأرضي', imageUrl: '' },
      { id: generateId(), number: 2, name: 'Second Floor', nameAr: 'الطابق الثاني', imageUrl: '' },
      { id: generateId(), number: 3, name: 'Third Floor', nameAr: 'الطابق الثالث', imageUrl: '' },
    ];
    set({ floors: defaults });
    supabase
      .from('floors')
      .insert(defaults.map(fromFloor))
      .then(({ error }) => {
        if (error) console.error('Failed to seed floors:', error);
      });
  },
}));
