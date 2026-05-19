import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type VisitorFormFieldKey =
  | 'visitorType'
  | 'visitedCompanyId'
  | 'floor'
  | 'name'
  | 'phone'
  | 'email'
  | 'nationalityType'
  | 'nationalityIdNumber'
  | 'countryCode'
  | 'signature'
  | 'terms';

export interface FormFieldConfig {
  key: VisitorFormFieldKey;
  visible: boolean;
  section: 'visit' | 'personal' | 'signature' | 'terms';
  alwaysRequired?: boolean;
}

const DEFAULT_ORDER: FormFieldConfig[] = [
  { key: 'visitorType',         visible: true,  section: 'visit',      alwaysRequired: true },
  { key: 'visitedCompanyId',    visible: true,  section: 'visit',      alwaysRequired: true },
  { key: 'floor',               visible: true,  section: 'visit',      alwaysRequired: true },
  { key: 'name',                visible: true,  section: 'personal' },
  { key: 'phone',               visible: true,  section: 'personal',   alwaysRequired: true },
  { key: 'email',               visible: true,  section: 'personal' },
  { key: 'nationalityType',     visible: true,  section: 'personal' },
  { key: 'nationalityIdNumber', visible: true,  section: 'personal' },
  { key: 'countryCode',         visible: true,  section: 'personal' },
  { key: 'signature',           visible: false, section: 'signature' },
  { key: 'terms',               visible: true,  section: 'terms',      alwaysRequired: true },
];

interface FormConfigState {
  fields: FormFieldConfig[];
  loaded: boolean;
  fetchFormConfig: () => Promise<void>;
  setFields: (fields: FormFieldConfig[]) => void;
  toggleVisible: (key: VisitorFormFieldKey) => void;
  reset: () => void;
  isVisible: (key: VisitorFormFieldKey) => boolean;
}

function upsertToDb(fields: FormFieldConfig[]) {
  supabase
    .from('form_config')
    .upsert({ id: 1, fields, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error('Failed to save form config:', error);
    });
}

export const useFormConfigStore = create<FormConfigState>()((set, get) => ({
  fields: DEFAULT_ORDER,
  loaded: false,

  fetchFormConfig: async () => {
    const { data, error } = await supabase
      .from('form_config')
      .select('fields')
      .eq('id', 1)
      .maybeSingle();

    if (error) { console.error('Failed to fetch form config:', error); set({ loaded: true }); return; }

    if (!data) {
      // First run — no config in DB yet, use defaults
      set({ loaded: true });
      return;
    }

    // Merge saved fields with DEFAULT_ORDER so any newly added keys appear
    const saved = data.fields as FormFieldConfig[];
    const savedKeys = new Set(saved.map(f => f.key));
    const merged = [...saved, ...DEFAULT_ORDER.filter(f => !savedKeys.has(f.key))];
    set({ fields: merged, loaded: true });
  },

  setFields: (fields) => {
    set({ fields });
    upsertToDb(fields);
  },

  toggleVisible: (key) => {
    const fields = get().fields.map(f =>
      f.key === key && !f.alwaysRequired ? { ...f, visible: !f.visible } : f
    );
    set({ fields });
    upsertToDb(fields);
  },

  reset: () => {
    set({ fields: DEFAULT_ORDER });
    upsertToDb(DEFAULT_ORDER);
  },

  isVisible: (key) => get().fields.find(f => f.key === key)?.visible ?? false,
}));
