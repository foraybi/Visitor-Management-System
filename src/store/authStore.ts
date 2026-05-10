import { create } from 'zustand';
import type { UserRole, AuthState } from '../types';

export const useAuthStore = create<AuthState>(set => ({
  currentRole: null,
  currentUserId: null,

  login: (role: UserRole, userId?: string) => {
    set({
      currentRole: role,
      currentUserId: userId || null,
    });
  },

  logout: () => {
    set({
      currentRole: null,
      currentUserId: null,
    });
  },
}));
