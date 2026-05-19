import { create } from 'zustand';
import type { UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthStore {
  currentRole: UserRole | null;
  currentUserId: string | null;
  currentEmail: string | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  loginAsVisitor: () => void;
  loginWithPassword: (
    email: string,
    password: string,
    role: 'frontdesk' | 'admin'
  ) => Promise<string | null>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  currentRole: null,
  currentUserId: null,
  currentEmail: null,
  isLoading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const role = session.user.user_metadata?.role as UserRole | undefined;
      if (role === 'frontdesk' || role === 'admin') {
        set({
          currentRole: role,
          currentUserId: session.user.id,
          currentEmail: session.user.email ?? null,
          isLoading: false,
        });
        return;
      }
    }
    set({ currentRole: null, currentUserId: null, currentEmail: null, isLoading: false });
  },

  loginAsVisitor: () => {
    set({ currentRole: 'visitor', currentUserId: null, currentEmail: null });
  },

  loginWithPassword: async (email, password, role) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    const userRole = data.user?.user_metadata?.role as UserRole | undefined;
    if (userRole !== role) {
      await supabase.auth.signOut();
      return 'Access denied. This account does not have the selected role.';
    }
    set({
      currentRole: role,
      currentUserId: data.user.id,
      currentEmail: data.user.email ?? null,
    });
    return null;
  },

  logout: async () => {
    // Visitor sessions are local-only — no Supabase session to clear
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await supabase.auth.signOut();
    set({ currentRole: null, currentUserId: null, currentEmail: null });
  },
}));
