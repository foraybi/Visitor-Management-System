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
    {
      name: 'vms-ui',
      // The saved language was restored into the store but never handed to
      // i18n, which always starts in Arabic. After a reload in English the page
      // was laid out left to right with Arabic text.
      onRehydrateStorage: () => (state) => {
        if (state && i18n.language !== state.language) void i18n.changeLanguage(state.language);
      },
    }
  )
);
