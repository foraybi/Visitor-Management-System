import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language, UIState } from '../types';
import i18n from '../i18n';

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      language: 'ar',
      dir: 'rtl',
      sidebarOpen: true,

      toggleLanguage: () => {
        const current = get().language;
        const newLang: Language = current === 'en' ? 'ar' : 'en';
        const newDir = newLang === 'ar' ? 'rtl' : 'ltr';

        i18n.changeLanguage(newLang);
        document.documentElement.setAttribute('dir', newDir);
        document.documentElement.setAttribute('lang', newLang);

        set({
          language: newLang,
          dir: newDir,
        });
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },
    }),
    { name: 'vms-ui' }
  )
);
