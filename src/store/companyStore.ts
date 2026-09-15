import { create } from 'zustand';
import type { Company, Employee, CompanyState } from '../types';
import { generateId } from '../utils/idGenerator';
import { supabase, toCompany, fromCompany, fromEmployee } from '../lib/supabase';
import { persist } from '../data/persist';

/** One company as sent to admin_import_companies. */
export interface ImportCompanyPayload {
  importRef: string | null;
  name: string;
  nameAr: string;
  phone: string;
  floor: number;
  crNumber: string | null;
  foundersLimit: number;
  employeesLimit: number;
  incubationStart: string | null;
  incubationEnd: string | null;
  founder: {
    name: string;
    nameAr: string;
    phone: string;
    email: string;
    nationalityType: string;
    nationalityIdNumber: string;
    countryCode: string;
    gender: 'male' | 'female' | null;
  } | null;
}

export type ImportResult =
  | { ok: true; created: number; skipped: number; founders: number }
  | { ok: false; error: string };

interface ExtendedCompanyState extends CompanyState {
  loaded: boolean;
  fetchCompanies: () => Promise<void>;
  /**
   * Create the selected companies and their founders in one transaction, then
   * reload. Rows already imported are skipped by the database.
   */
  importCompanies: (companies: ImportCompanyPayload[]) => Promise<ImportResult>;
}

export const useCompanyStore = create<ExtendedCompanyState>()((set, get) => ({
  companies: [],
  loaded: false,

  fetchCompanies: async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('*, employees(*)')
      .order('name');
    if (error) {
      console.error('Failed to fetch companies:', error);
      return;
    }
    set({ companies: (data ?? []).map(toCompany), loaded: true });
  },

  importCompanies: async (companies) => {
    const { data, error } = await supabase.rpc('admin_import_companies', { p_companies: companies });
    if (error) return { ok: false, error: error.message };
    await get().fetchCompanies();
    const result = (data ?? {}) as { created?: number; skipped?: number; founders?: number };
    return {
      ok: true,
      created: result.created ?? 0,
      skipped: result.skipped ?? 0,
      founders: result.founders ?? 0,
    };
  },

  addCompany: (data: Omit<Company, 'id'>) => {
    const id = generateId();
    const company: Company = { ...data, id };
    const previous = get().companies;
    set(state => ({ companies: [...state.companies, company] }));

    void (async () => {
      const created = await persist(
        'company.add',
        () =>
          supabase
            .from('companies')
            .insert(
              fromCompany({
                id,
                name: data.name,
                nameAr: data.nameAr,
                logoUrl: data.logoUrl,
                phone: data.phone,
                floor: data.floor,
                crNumber: data.crNumber,
                foundersLimit: data.foundersLimit,
                employeesLimit: data.employeesLimit,
                incubationStart: data.incubationStart,
                incubationEnd: data.incubationEnd,
              }),
            ),
        () => set({ companies: previous }),
      );
      if (!created) return;

      if (data.employees && data.employees.length > 0) {
        // The company landed but its employees did not, so roll back only the
        // employees rather than discarding a company that now exists.
        await persist(
          'employee.addMany',
          () => supabase.from('employees').insert(data.employees.map(e => fromEmployee(e, id))),
          () =>
            set(state => ({
              companies: state.companies.map(c =>
                c.id === id ? { ...c, employees: [], employeeCount: 0 } : c,
              ),
            })),
        );
      }
    })();
  },

  updateCompany: (id: string, data: Partial<Company>) => {
    const previous = get().companies;
    set(state => ({
      companies: state.companies.map(c => (c.id === id ? { ...c, ...data } : c)),
    }));
    const row: Record<string, unknown> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.nameAr !== undefined) row.name_ar = data.nameAr;
    if (data.logoUrl !== undefined) row.logo_url = data.logoUrl || null;
    if (data.phone !== undefined) row.phone = data.phone;
    if (data.floor !== undefined) row.floor = data.floor;
    if (data.crNumber !== undefined) row.cr_number = data.crNumber || null;
    if (data.foundersLimit !== undefined) row.founders_limit = data.foundersLimit;
    if (data.employeesLimit !== undefined) row.employees_limit = data.employeesLimit;
    if (data.incubationStart !== undefined) row.incubation_start = data.incubationStart || null;
    if (data.incubationEnd !== undefined) row.incubation_end = data.incubationEnd || null;
    if (Object.keys(row).length > 0) {
      void persist(
        'company.update',
        () => supabase.from('companies').update(row).eq('id', id),
        () => set({ companies: previous }),
      );
    }
  },

  deleteCompany: (id: string) => {
    const previous = get().companies;
    set(state => ({ companies: state.companies.filter(c => c.id !== id) }));
    void persist(
      'company.delete',
      () => supabase.from('companies').delete().eq('id', id),
      () => set({ companies: previous }),
    );
  },

  addEmployee: (companyId: string, employee: Omit<Employee, 'id'>) => {
    const id = generateId();
    const newEmployee: Employee = { ...employee, id };
    const previous = get().companies;
    set(state => ({
      companies: state.companies.map(c =>
        c.id === companyId
          ? { ...c, employees: [...c.employees, newEmployee], employeeCount: c.employees.length + 1 }
          : c
      ),
    }));
    void persist(
      'employee.add',
      () => supabase.from('employees').insert(fromEmployee(newEmployee, companyId)),
      () => set({ companies: previous }),
    );
  },

  updateEmployee: (companyId: string, employeeId: string, data: Partial<Employee>) => {
    const previous = get().companies;
    set(state => ({
      companies: state.companies.map(c =>
        c.id === companyId
          ? { ...c, employees: c.employees.map(e => (e.id === employeeId ? { ...e, ...data } : e)) }
          : c
      ),
    }));
    const row: Record<string, unknown> = {};
    if (data.employeeNumber !== undefined) row.employee_number = data.employeeNumber;
    if (data.name !== undefined) row.name = data.name;
    if (data.nameAr !== undefined) row.name_ar = data.nameAr;
    if (data.phone !== undefined) row.phone = data.phone;
    if (data.email !== undefined) row.email = data.email ?? null;
    if (data.nationalityType !== undefined) row.nationality_type = data.nationalityType;
    if (data.nationalityIdNumber !== undefined) row.nationality_id_number = data.nationalityIdNumber;
    if (data.countryCode !== undefined) row.country_code = data.countryCode;
    if (data.gender !== undefined) row.gender = data.gender ?? null;
    if (data.employeeType !== undefined) row.employee_type = data.employeeType;
    if (data.employmentStatus !== undefined) row.employment_status = data.employmentStatus;
    if (data.jobType !== undefined) row.job_type = data.jobType;
    if (data.department !== undefined) row.department = data.department ?? null;
    if (data.position !== undefined) row.position = data.position ?? null;
    if (data.hireDate !== undefined) row.hire_date = data.hireDate ?? null;
    if (data.photoDataUrl !== undefined) row.photo_data_url = data.photoDataUrl ?? null;
    if (data.notes !== undefined) row.notes = data.notes ?? null;
    if (data.verificationStatus !== undefined) row.verification_status = data.verificationStatus;
    if (Object.keys(row).length > 0) {
      void persist(
        'employee.update',
        () => supabase.from('employees').update(row).eq('id', employeeId),
        () => set({ companies: previous }),
      );
    }
  },

  deleteEmployee: (companyId: string, employeeId: string) => {
    const previous = get().companies;
    set(state => ({
      companies: state.companies.map(c =>
        c.id === companyId
          ? {
              ...c,
              employees: c.employees.filter(e => e.id !== employeeId),
              employeeCount: Math.max(0, c.employees.length - 1),
            }
          : c
      ),
    }));
    void persist(
      'employee.delete',
      () => supabase.from('employees').delete().eq('id', employeeId),
      () => set({ companies: previous }),
    );
  },

  verifyEmployee: (companyId: string, employeeId: string) => {
    const previous = get().companies;
    set(state => ({
      companies: state.companies.map(c =>
        c.id === companyId
          ? {
              ...c,
              employees: c.employees.map(e =>
                e.id === employeeId ? { ...e, verificationStatus: 'verified' } : e
              ),
            }
          : c
      ),
    }));
    void persist(
      'employee.verify',
      () => supabase.from('employees').update({ verification_status: 'verified' }).eq('id', employeeId),
      () => set({ companies: previous }),
    );
  },

  findEmployeeByIdNumber: (idNumber: string) => {
    for (const c of get().companies) {
      const employee = c.employees.find(
        e => e.nationalityIdNumber === idNumber && e.employmentStatus === 'active'
      );
      if (employee) return { employee, companyId: c.id };
    }
    return null;
  },

  getFrontDeskUsers: () => [],
  addFrontDeskUser: () => {},
  removeFrontDeskUser: () => {},
}));
