import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole, AuthState } from '../types';

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
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
    }),
    { name: 'vms-auth' }
  )
);
