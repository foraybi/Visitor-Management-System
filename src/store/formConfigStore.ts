import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** Visitor-flow fields only — employee path always shows phone + employeeNumber */
  section: 'visit' | 'personal' | 'signature' | 'terms';
  /** Required toggle is locked for some fields (e.g. visitorType always required) */
  alwaysRequired?: boolean;
}

const DEFAULT_ORDER: FormFieldConfig[] = [
  { key: 'visitorType', visible: true, section: 'visit', alwaysRequired: true },
  { key: 'visitedCompanyId', visible: true, section: 'visit', alwaysRequired: true },
  { key: 'floor', visible: true, section: 'visit', alwaysRequired: true },
  { key: 'name', visible: true, section: 'personal' },
  { key: 'phone', visible: true, section: 'personal', alwaysRequired: true },
  { key: 'email', visible: true, section: 'personal' },
  { key: 'nationalityType', visible: true, section: 'personal' },
  { key: 'nationalityIdNumber', visible: true, section: 'personal' },
  { key: 'countryCode', visible: true, section: 'personal' },
  { key: 'signature', visible: false, section: 'signature' },
  { key: 'terms', visible: true, section: 'terms', alwaysRequired: true },
];

interface FormConfigState {
  fields: FormFieldConfig[];
  setFields: (fields: FormFieldConfig[]) => void;
  toggleVisible: (key: VisitorFormFieldKey) => void;
  reset: () => void;
  isVisible: (key: VisitorFormFieldKey) => boolean;
}

export const useFormConfigStore = create<FormConfigState>()(
  persist(
    (set, get) => ({
      fields: DEFAULT_ORDER,

      setFields: (fields) => set({ fields }),

      toggleVisible: (key) =>
        set(state => ({
          fields: state.fields.map(f =>
            f.key === key && !f.alwaysRequired ? { ...f, visible: !f.visible } : f
          ),
        })),

      reset: () => set({ fields: DEFAULT_ORDER }),

      isVisible: (key) => get().fields.find(f => f.key === key)?.visible ?? false,
    }),
    {
      name: 'vms-form-config',
      merge: (persisted, current) => {
        // Ensure new keys added to DEFAULT_ORDER are merged in even when persisted state exists
        const p = (persisted as FormConfigState) ?? current;
        const existingKeys = new Set(p.fields?.map(f => f.key));
        const merged = [
          ...(p.fields ?? []),
          ...DEFAULT_ORDER.filter(f => !existingKeys.has(f.key)),
        ];
        return { ...current, ...p, fields: merged };
      },
    }
  )
);
