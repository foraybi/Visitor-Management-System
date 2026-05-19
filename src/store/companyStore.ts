import { create } from 'zustand';
import type { Company, Employee, CompanyState } from '../types';
import { generateId } from '../utils/idGenerator';
import { supabase, toCompany, fromCompany, fromEmployee } from '../lib/supabase';

interface ExtendedCompanyState extends CompanyState {
  loaded: boolean;
  fetchCompanies: () => Promise<void>;
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

  addCompany: (data: Omit<Company, 'id'>) => {
    const id = generateId();
    const company: Company = { ...data, id };
    set(state => ({ companies: [...state.companies, company] }));
    supabase
      .from('companies')
      .insert(fromCompany({ id, name: data.name, nameAr: data.nameAr, logoUrl: data.logoUrl, phone: data.phone, floor: data.floor }))
      .then(({ error }) => {
        if (error) { console.error('Failed to insert company:', error); return; }
        if (data.employees && data.employees.length > 0) {
          supabase
            .from('employees')
            .insert(data.employees.map(e => fromEmployee(e, id)))
            .then(({ error: eErr }) => {
              if (eErr) console.error('Failed to insert employees:', eErr);
            });
        }
      });
  },

  updateCompany: (id: string, data: Partial<Company>) => {
    set(state => ({
      companies: state.companies.map(c => (c.id === id ? { ...c, ...data } : c)),
    }));
    const row: Record<string, unknown> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.nameAr !== undefined) row.name_ar = data.nameAr;
    if (data.logoUrl !== undefined) row.logo_url = data.logoUrl || null;
    if (data.phone !== undefined) row.phone = data.phone;
    if (data.floor !== undefined) row.floor = data.floor;
    if (Object.keys(row).length > 0) {
      supabase
        .from('companies')
        .update(row)
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Failed to update company:', error);
        });
    }
  },

  deleteCompany: (id: string) => {
    set(state => ({ companies: state.companies.filter(c => c.id !== id) }));
    supabase
      .from('companies')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Failed to delete company:', error);
      });
  },

  addEmployee: (companyId: string, employee: Omit<Employee, 'id'>) => {
    const id = generateId();
    const newEmployee: Employee = { ...employee, id };
    set(state => ({
      companies: state.companies.map(c =>
        c.id === companyId
          ? { ...c, employees: [...c.employees, newEmployee], employeeCount: c.employees.length + 1 }
          : c
      ),
    }));
    supabase
      .from('employees')
      .insert(fromEmployee(newEmployee, companyId))
      .then(({ error }) => {
        if (error) console.error('Failed to insert employee:', error);
      });
  },

  updateEmployee: (companyId: string, employeeId: string, data: Partial<Employee>) => {
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
    if (data.gender !== undefined) row.gender = data.gender;
    if (data.employmentStatus !== undefined) row.employment_status = data.employmentStatus;
    if (data.jobType !== undefined) row.job_type = data.jobType;
    if (data.department !== undefined) row.department = data.department ?? null;
    if (data.position !== undefined) row.position = data.position ?? null;
    if (data.hireDate !== undefined) row.hire_date = data.hireDate ?? null;
    if (data.photoDataUrl !== undefined) row.photo_data_url = data.photoDataUrl ?? null;
    if (data.notes !== undefined) row.notes = data.notes ?? null;
    if (data.verificationStatus !== undefined) row.verification_status = data.verificationStatus;
    if (Object.keys(row).length > 0) {
      supabase
        .from('employees')
        .update(row)
        .eq('id', employeeId)
        .then(({ error }) => {
          if (error) console.error('Failed to update employee:', error);
        });
    }
  },

  deleteEmployee: (companyId: string, employeeId: string) => {
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
    supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .then(({ error }) => {
        if (error) console.error('Failed to delete employee:', error);
      });
  },

  verifyEmployee: (companyId: string, employeeId: string) => {
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
    supabase
      .from('employees')
      .update({ verification_status: 'verified' })
      .eq('id', employeeId)
      .then(({ error }) => {
        if (error) console.error('Failed to verify employee:', error);
      });
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
