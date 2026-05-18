import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, Employee, CompanyState } from '../types';
import { generateId } from '../utils/idGenerator';

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      companies: [],

      addCompany: (data: Omit<Company, 'id'>) => {
        const id = generateId();
        const company: Company = { ...data, id };
        set(state => ({ companies: [...state.companies, company] }));
      },

      updateCompany: (id: string, data: Partial<Company>) => {
        set(state => ({
          companies: state.companies.map(c =>
            c.id === id ? { ...c, ...data } : c
          ),
        }));
      },

      deleteCompany: (id: string) => {
        set(state => ({
          companies: state.companies.filter(c => c.id !== id),
        }));
      },

      addEmployee: (companyId: string, employee: Omit<Employee, 'id'>) => {
        const id = generateId();
        set(state => ({
          companies: state.companies.map(c =>
            c.id === companyId
              ? {
                  ...c,
                  employees: [...c.employees, { ...employee, id }],
                  employeeCount: c.employees.length + 1,
                }
              : c
          ),
        }));
      },

      updateEmployee: (
        companyId: string,
        employeeId: string,
        data: Partial<Employee>
      ) => {
        set(state => ({
          companies: state.companies.map(c =>
            c.id === companyId
              ? {
                  ...c,
                  employees: c.employees.map(e =>
                    e.id === employeeId ? { ...e, ...data } : e
                  ),
                }
              : c
          ),
        }));
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

      getFrontDeskUsers: () => {
        // Mock: return empty for now, implement in future
        return [];
      },

      addFrontDeskUser: () => {
        // Implement in future
      },

      removeFrontDeskUser: () => {
        // Implement in future
      },
    }),
    { name: 'vms-companies' }
  )
);
