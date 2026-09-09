import type { Dayjs } from 'dayjs';
import type {
  Company,
  EmploymentStatus,
  Employee,
  JobType,
  NationalityType,
} from './index';

/**
 * The shapes the admin and front desk forms hand back.
 *
 * These differ from the domain records in two ways, which is why they are typed
 * separately rather than reusing `Employee` and `Company` directly. Date pickers
 * yield a Dayjs rather than a string, and a form only carries the fields it
 * renders, so optionality does not match the stored record.
 *
 * The employee form exists in two components that have already drifted apart.
 * One shared type is the first step toward collapsing them; until then it at
 * least makes the drift visible at compile time.
 */

export interface CompanyFormValues extends Pick<Company, 'name' | 'nameAr' | 'phone' | 'floor'> {
  logoUrl?: string;
}

export interface EmployeeFormValues {
  employeeNumber: string;
  name: string;
  nameAr: string;
  phone: string;
  email?: string;
  nationalityType: NationalityType;
  nationalityIdNumber: string;
  countryCode: string;
  gender: Employee['gender'];
  employmentStatus?: EmploymentStatus;
  jobType: JobType;
  department?: string;
  position?: string;
  /** A date picker yields a Dayjs; the record stores an ISO date string. */
  hireDate?: Dayjs | string | null;
  notes?: string;
}
