import { useEffect } from 'react';
import { useCompanyStore } from '../store/companyStore';
import { useFloorStore } from '../store/floorStore';
import type { Employee } from '../types';

const emp = (data: Omit<Employee, 'id'> & { id: string }): Employee => data;

export function useSeedData() {
  const { companies, addCompany } = useCompanyStore();
  const { floors, seedDefaults } = useFloorStore();

  useEffect(() => {
    if (floors.length === 0) {
      seedDefaults();
    }
  }, [floors.length, seedDefaults]);

  useEffect(() => {
    if (companies.length === 0) {
      addCompany({
        name: 'Saudi Aramco',
        nameAr: 'أرامكو السعودية',
        logoUrl: '',
        phone: '0112345678',
        floor: 1,
        employeeCount: 2,
        employees: [
          emp({
            id: 'e1',
            employeeNumber: '0001',
            name: 'Ahmed Al-Rashidi',
            nameAr: 'أحمد الرشيدي',
            phone: '0501234567',
            email: 'ahmed.rashidi@aramco.com',
            nationalityType: 'national_id',
            nationalityIdNumber: '1012345678',
            countryCode: 'SA',
            gender: 'male',
            employmentStatus: 'active',
            jobType: 'full_time',
            department: 'IT',
            position: 'Software Engineer',
            hireDate: '2022-03-15',
            verificationStatus: 'verified',
          }),
          emp({
            id: 'e2',
            employeeNumber: '0002',
            name: 'Sara Al-Qahtani',
            nameAr: 'سارة القحطاني',
            phone: '0507654321',
            email: 'sara.qahtani@aramco.com',
            nationalityType: 'national_id',
            nationalityIdNumber: '1087654321',
            countryCode: 'SA',
            gender: 'female',
            employmentStatus: 'active',
            jobType: 'full_time',
            department: 'HR',
            position: 'HR Manager',
            hireDate: '2020-06-01',
            verificationStatus: 'verified',
          }),
        ],
      });

      addCompany({
        name: 'Microsoft KSA',
        nameAr: 'مايكروسوفت السعودية',
        logoUrl: '',
        phone: '0118765432',
        floor: 2,
        employeeCount: 1,
        employees: [
          emp({
            id: 'e3',
            employeeNumber: '0003',
            name: 'Fatima Al-Otaibi',
            nameAr: 'فاطمة العتيبي',
            phone: '0505555555',
            email: 'fatima.otaibi@microsoft.com',
            nationalityType: 'iqama',
            nationalityIdNumber: '2055555555',
            countryCode: 'SA',
            gender: 'female',
            employmentStatus: 'active',
            jobType: 'part_time',
            department: 'Sales',
            position: 'Account Executive',
            hireDate: '2023-09-12',
            verificationStatus: 'verified',
          }),
        ],
      });

      addCompany({
        name: 'Acme Corp',
        nameAr: 'شركة أكمي',
        logoUrl: '',
        phone: '0114567890',
        floor: 3,
        employeeCount: 1,
        employees: [
          emp({
            id: 'e4',
            employeeNumber: '0004',
            name: 'Mohammed Al-Dossary',
            nameAr: 'محمد الدوسري',
            phone: '0503333333',
            email: 'mohammed.dossary@acme.com',
            nationalityType: 'national_id',
            nationalityIdNumber: '1033333333',
            countryCode: 'SA',
            gender: 'male',
            employmentStatus: 'active',
            jobType: 'internship',
            department: 'Engineering',
            position: 'Intern',
            hireDate: '2026-01-10',
            verificationStatus: 'verified',
          }),
        ],
      });
    }
  }, [companies.length, addCompany]);
}
