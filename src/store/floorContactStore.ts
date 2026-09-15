import { create } from 'zustand';
import type { FloorContact } from '../types';
import { persist } from '../data/persist';
import { supabase, toFloorContact } from '../lib/supabase';

/**
 * Administration contacts per floor.
 *
 * Shown to the front desk when a company's founder or employee list is full.
 * Every signed-in staff member reads them; only an admin writes them, which
 * Row Level Security enforces.
 */

interface FloorContactState {
  contacts: FloorContact[];
  loaded: boolean;
  fetchContacts: () => Promise<void>;
  addContact: (data: Omit<FloorContact, 'id'>) => void;
  updateContact: (id: string, data: Partial<Omit<FloorContact, 'id'>>) => void;
  deleteContact: (id: string) => void;
}

export const useFloorContactStore = create<FloorContactState>()((set, get) => ({
  contacts: [],
  loaded: false,

  fetchContacts: async () => {
    const { data, error } = await supabase
      .from('floor_contacts')
      .select('id, floor, name, phone, sort_order')
      .order('floor')
      .order('sort_order')
      .order('created_at');
    if (error) {
      console.error('Failed to fetch floor contacts:', error);
      return;
    }
    set({ contacts: (data ?? []).map(toFloorContact), loaded: true });
  },

  addContact: (data) => {
    const id = crypto.randomUUID();
    const previous = get().contacts;
    set((state) => ({ contacts: [...state.contacts, { ...data, id }] }));
    void persist(
      'floorContact.add',
      () =>
        supabase.from('floor_contacts').insert({
          id,
          floor: data.floor,
          name: data.name,
          phone: data.phone,
          sort_order: data.sortOrder,
        }),
      () => set({ contacts: previous }),
    );
  },

  updateContact: (id, data) => {
    const previous = get().contacts;
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
    const row: Record<string, unknown> = {};
    if (data.floor !== undefined) row.floor = data.floor;
    if (data.name !== undefined) row.name = data.name;
    if (data.phone !== undefined) row.phone = data.phone;
    if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
    if (Object.keys(row).length === 0) return;
    void persist(
      'floorContact.update',
      () => supabase.from('floor_contacts').update(row).eq('id', id),
      () => set({ contacts: previous }),
    );
  },

  deleteContact: (id) => {
    const previous = get().contacts;
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
    void persist(
      'floorContact.delete',
      () => supabase.from('floor_contacts').delete().eq('id', id),
      () => set({ contacts: previous }),
    );
  },
}));
