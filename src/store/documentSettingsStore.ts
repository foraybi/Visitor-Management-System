import { create } from 'zustand';
import { supabase, uploadFile, urlToBase64 } from '../lib/supabase';

export interface DocumentSettings {
  admissionName: string;
  admissionLabel: string;
  formIdVersion: string;
  formIdVersionLabel: string;
  visionNumber: string;
  visionNumberLabel: string;
  formName: string;
  logoUrl: string;      // Supabase Storage public URL — stored in DB, used for display
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

function upsertToDb(s: DocumentSettings) {
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
    })
    .then(({ error }) => {
      if (error) console.error('Failed to save document settings:', error);
    });
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
    const logoDataUrl = logoUrl ? await urlToBase64(logoUrl) : '';

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
    const settings = { ...get().settings, ...s };
    set({ settings });
    upsertToDb(settings);
  },

  uploadLogo: async (file: File) => {
    const ext = file.name.split('.').pop() ?? 'png';
    const logoUrl = await uploadFile('document-logos', `logo.${ext}`, file);
    const logoDataUrl = await urlToBase64(logoUrl);
    const settings = { ...get().settings, logoUrl, logoDataUrl };
    set({ settings });
    upsertToDb(settings);
  },

  removeLogo: () => {
    const settings = { ...get().settings, logoUrl: '', logoDataUrl: '' };
    set({ settings });
    upsertToDb(settings);
  },

  reset: () => {
    set({ settings: DEFAULTS });
    upsertToDb(DEFAULTS);
  },
}));
