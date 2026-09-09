import { create } from 'zustand';
import { isRole, type Role } from '../domain/access/access';
import { supabase } from '../lib/supabase';

/**
 * Staff authentication for the staff app.
 *
 * The role is read from the `profiles` table, never from the session's
 * `user_metadata`. That claim is writable by the user it describes, so reading
 * it here meant any signed-in account could call
 * `supabase.auth.updateUser({ data: { role: 'admin' } })` from the browser
 * console and be handed the admin console. Row Level Security now reads the same
 * `profiles` row, so the interface and the database agree on one answer.
 *
 * There is no visitor role here. The kiosk is a separate build on a separate
 * origin with no Supabase session at all.
 */

interface AuthStore {
  currentRole: Role | null;
  currentUserId: string | null;
  currentEmail: string | null;
  isLoading: boolean;
  initialize: () => Promise<() => void>;
  loginWithPassword: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const SIGNED_OUT = {
  currentRole: null,
  currentUserId: null,
  currentEmail: null,
} as const;

/**
 * Read the signed-in user's role from `profiles`.
 *
 * Returns null when there is no row or the value is not a role we recognise.
 * Failing closed matters: an unreadable profile must not fall back to any
 * access at all.
 */
async function fetchRole(userId: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return isRole(data.role) ? data.role : null;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...SIGNED_OUT,
  isLoading: true,

  /**
   * Restore the session and subscribe to changes.
   *
   * Returns the unsubscribe function. The app previously had no
   * `onAuthStateChange` listener at all, so a session that expired or was
   * revoked elsewhere left a stale role in memory until a full page reload, and
   * signing out in one tab left the others believing they were still signed in.
   */
  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const role = await fetchRole(session.user.id);
      set({
        currentRole: role,
        currentUserId: role ? session.user.id : null,
        currentEmail: role ? (session.user.email ?? null) : null,
        isLoading: false,
      });
    } else {
      set({ ...SIGNED_OUT, isLoading: false });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || !next?.user) {
        set({ ...SIGNED_OUT, isLoading: false });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const user = next.user;
        void fetchRole(user.id).then((role) => {
          set({
            currentRole: role,
            currentUserId: role ? user.id : null,
            currentEmail: role ? (user.email ?? null) : null,
            isLoading: false,
          });
        });
      }
    });

    return () => subscription.unsubscribe();
  },

  /**
   * Sign in. Returns an error message, or null on success.
   *
   * The caller no longer states which role it expects. Previously the login
   * screen asked the user to pick "front desk" or "admin" and the answer was
   * compared against a claim the user could edit. The account's role decides
   * where it lands, and the database decides what it can do.
   */
  loginWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    const user = data.user;
    if (!user) return 'Sign in failed. Try again.';

    const role = await fetchRole(user.id);
    if (!role) {
      // Authenticated but not staff, or the profile row was removed. Do not
      // leave a usable session behind.
      await supabase.auth.signOut();
      return 'This account has no access. Ask an administrator to set it up.';
    }

    set({ currentRole: role, currentUserId: user.id, currentEmail: user.email ?? null });
    return null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ ...SIGNED_OUT });
  },
}));
