import { useEffect } from 'react';
import { useCompanyStore } from '../store/companyStore';
import { useFloorStore } from '../store/floorStore';

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
          { id: 'e1', employeeNumber: '0001', name: 'Ahmed Al-Rashidi', phone: '0501234567', gender: 'male' },
          { id: 'e2', employeeNumber: '0002', name: 'Sara Al-Qahtani', phone: '0507654321', gender: 'female' },
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
          { id: 'e3', employeeNumber: '0003', name: 'Fatima Al-Otaibi', phone: '0505555555', gender: 'female' },
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
          { id: 'e4', employeeNumber: '0004', name: 'Mohammed Al-Dossary', phone: '0503333333', gender: 'male' },
        ],
      });
    }
  }, [companies.length, addCompany]);
}
