import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DocumentSettings {
  admissionName: string;
  admissionLabel: string;
  formIdVersion: string;
  formIdVersionLabel: string;
  visionNumber: string;
  visionNumberLabel: string;
  formName: string;
  logoDataUrl: string;
}

interface DocumentSettingsState {
  settings: DocumentSettings;
  setSettings: (s: Partial<DocumentSettings>) => void;
  reset: () => void;
}

const DEFAULTS: DocumentSettings = {
  admissionName: '',
  admissionLabel: 'Admission Name',
  formIdVersion: '',
  formIdVersionLabel: 'Form ID / Version',
  visionNumber: '',
  visionNumberLabel: 'Vision Number',
  formName: 'Visitor Management Report',
  logoDataUrl: '',
};

export const useDocumentSettingsStore = create<DocumentSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      setSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),
      reset: () => set({ settings: DEFAULTS }),
    }),
    { name: 'vms-document-settings' }
  )
);
