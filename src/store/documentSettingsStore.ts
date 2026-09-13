import { create } from 'zustand';
import { persist } from '../data/persist';
import { supabase } from '../lib/supabase';
import { removeFromStorage, storageObjectAsDataUrl, uploadToStorage } from '../data/storage';

export interface DocumentSettings {
  admissionName: string;
  admissionLabel: string;
  formIdVersion: string;
  formIdVersionLabel: string;
  visionNumber: string;
  visionNumberLabel: string;
  formName: string;
  logoUrl: string;      // object path in the document-logos bucket; resolved to a URL when shown
  logoDataUrl: string;  // base64 — derived from logoUrl on fetch, in-memory only, used by jsPDF
}

interface DocumentSettingsState {
  settings: DocumentSettings;
  loaded: boolean;
  fetchDocumentSettings: () => Promise<void>;
  setSettings: (s: Partial<DocumentSettings>) => void;
  uploadLogo: (file: File) => Promise<void>;
  removeLogo: () => void;
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
  logoUrl: '',
  logoDataUrl: '',
};

function upsertToDb(s: DocumentSettings, rollback: () => void): Promise<boolean> {
  return persist(
    'documentSettings.save',
    () =>
      supabase
      .from('document_settings')
      .upsert({
      id: 1,
      admission_name: s.admissionName,
      admission_label: s.admissionLabel,
      form_id_version: s.formIdVersion,
      form_id_version_label: s.formIdVersionLabel,
      vision_number: s.visionNumber,
      vision_number_label: s.visionNumberLabel,
      form_name: s.formName,
        logo_url: s.logoUrl,
        updated_at: new Date().toISOString(),
      }),
    rollback,
  );
}

export const useDocumentSettingsStore = create<DocumentSettingsState>()((set, get) => ({
  settings: DEFAULTS,
  loaded: false,

  fetchDocumentSettings: async () => {
    const { data, error } = await supabase
      .from('document_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) { console.error('Failed to fetch document settings:', error); set({ loaded: true }); return; }
    if (!data) { set({ loaded: true }); return; }

    const logoUrl = data.logo_url ?? '';
    const logoDataUrl = await storageObjectAsDataUrl('document-logos', logoUrl);

    set({
      settings: {
        admissionName: data.admission_name ?? '',
        admissionLabel: data.admission_label ?? 'Admission Name',
        formIdVersion: data.form_id_version ?? '',
        formIdVersionLabel: data.form_id_version_label ?? 'Form ID / Version',
        visionNumber: data.vision_number ?? '',
        visionNumberLabel: data.vision_number_label ?? 'Vision Number',
        formName: data.form_name ?? 'Visitor Management Report',
        logoUrl,
        logoDataUrl,
      },
      loaded: true,
    });
  },

  setSettings: (s) => {
    const previous = get().settings;
    const settings = { ...previous, ...s };
    set({ settings });
    upsertToDb(settings, () => set({ settings: previous }));
  },

  uploadLogo: async (file: File) => {
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
    // A fresh name per upload. Browsers cache a public URL, so reusing one name
    // kept showing the old logo after it was replaced.
    const logoUrl = await uploadToStorage('document-logos', `logo-${Date.now()}.${ext}`, file);
    const logoDataUrl = await storageObjectAsDataUrl('document-logos', logoUrl);
    const previous = get().settings;
    const settings = { ...previous, logoUrl, logoDataUrl };
    set({ settings });

    const saved = await upsertToDb(settings, () => set({ settings: previous }));
    // Keep exactly one logo in the bucket: drop the old file once the new one is
    // saved, or the new file if saving failed.
    await removeFromStorage('document-logos', saved ? previous.logoUrl : logoUrl).catch(() => {});
  },

  removeLogo: () => {
    const previous = get().settings;
    const settings = { ...previous, logoUrl: '', logoDataUrl: '' };
    set({ settings });
    void upsertToDb(settings, () => set({ settings: previous })).then((saved) => {
      if (saved) void removeFromStorage('document-logos', previous.logoUrl).catch(() => {});
    });
  },

  reset: () => {
    const previous = get().settings;
    set({ settings: DEFAULTS });
    upsertToDb(DEFAULTS, () => set({ settings: previous }));
  },
}));
