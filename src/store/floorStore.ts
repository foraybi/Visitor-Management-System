import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FloorInfo } from '../types';
import { generateId } from '../utils/idGenerator';

interface FloorState {
  floors: FloorInfo[];
  addFloor: (data: Omit<FloorInfo, 'id'>) => void;
  updateFloor: (id: string, data: Partial<FloorInfo>) => void;
  deleteFloor: (id: string) => void;
  seedDefaults: () => void;
}

export const useFloorStore = create<FloorState>()(
  persist(
    (set, get) => ({
      floors: [],

      addFloor: (data) => {
        const id = generateId();
        set(state => ({ floors: [...state.floors, { ...data, id }] }));
      },

      updateFloor: (id, data) => {
        set(state => ({
          floors: state.floors.map(f => (f.id === id ? { ...f, ...data } : f)),
        }));
      },

      deleteFloor: (id) => {
        set(state => ({ floors: state.floors.filter(f => f.id !== id) }));
      },

      seedDefaults: () => {
        if (get().floors.length === 0) {
          set({
            floors: [
              { id: generateId(), number: 1, name: 'Ground Floor', nameAr: 'الطابق الأرضي', imageUrl: '' },
              { id: generateId(), number: 2, name: 'Second Floor', nameAr: 'الطابق الثاني', imageUrl: '' },
              { id: generateId(), number: 3, name: 'Third Floor', nameAr: 'الطابق الثالث', imageUrl: '' },
            ],
          });
        }
      },
    }),
    { name: 'vms-floors' }
  )
);
