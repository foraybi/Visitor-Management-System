export type VisitorStatus = 'active' | 'exited';
export type VisitorType = 'visitor' | 'employee';
export type NationalityType = 'national_id' | 'iqama' | 'passport';
export type UserRole = 'visitor' | 'frontdesk' | 'admin';
export type Language = 'en' | 'ar';
export type Floor = number;

export interface FloorInfo {
  id: string;
  number: number;
  name: string;
  nameAr: string;
  imageUrl: string;
}

export interface Visitor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nationalityType: NationalityType;
  nationalityIdNumber: string;
  countryCode: string;
  countryName: string;
  visitorType: VisitorType;
  visitedCompanyId: string;
  floor: Floor;
  signatureDataUrl: string;
  entryTime: string;
  exitTime: string | null;
  status: VisitorStatus;
  date: string;
}

export type EmploymentStatus = 'active' | 'inactive';
export type JobType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type VerificationStatus = 'verified' | 'pending';

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  nameAr: string;
  phone: string;
  email?: string;
  nationalityType: NationalityType;
  nationalityIdNumber: string;
  countryCode: string;
  gender: 'male' | 'female';
  employmentStatus: EmploymentStatus;
  jobType: JobType;
  department?: string;
  position?: string;
  hireDate?: string;
  photoDataUrl?: string;
  notes?: string;
  /** Admin-controlled verification flag. New employees added by frontdesk default to 'pending'. */
  verificationStatus: VerificationStatus;
}

export interface Company {
  id: string;
  name: string;
  nameAr: string;
  logoUrl: string;
  phone: string;
  floor: Floor;
  employeeCount: number;
  employees: Employee[];
}

export interface FrontDeskUser {
  id: string;
  username: string;
  password: string;
}

export interface PersonalInfoFormData {
  name: string;
  phone: string;
  email?: string;
  nationalityType: NationalityType;
  nationalityIdNumber: string;
  countryCode: string;
}

export interface VisitInfoFormData {
  visitorType: VisitorType;
  visitedCompanyId: string;
  floor: Floor;
}

export interface EnterFormData extends PersonalInfoFormData, VisitInfoFormData {
  signatureDataUrl: string;
}

export interface ExitFormData {
  visitorId: string;
}

export interface VisitorState {
  visitors: Visitor[];
  addVisitor: (data: EnterFormData) => string;
  exitVisitor: (id: string) => boolean;
  getVisitorById: (id: string) => Visitor | undefined;
  getTodayVisitors: () => Visitor[];
  getActiveVisitors: () => Visitor[];
}

export interface CompanyState {
  companies: Company[];
  addCompany: (data: Omit<Company, 'id'>) => void;
  updateCompany: (id: string, data: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  addEmployee: (companyId: string, employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (companyId: string, employeeId: string, data: Partial<Employee>) => void;
  deleteEmployee: (companyId: string, employeeId: string) => void;
  verifyEmployee: (companyId: string, employeeId: string) => void;
  findEmployeeByIdNumber: (idNumber: string) => { employee: Employee; companyId: string } | null;
  getFrontDeskUsers: () => FrontDeskUser[];
  addFrontDeskUser: (user: Omit<FrontDeskUser, 'id'>) => void;
  removeFrontDeskUser: (id: string) => void;
}

export interface AuthState {
  currentRole: UserRole | null;
  currentUserId: string | null;
  currentEmail: string | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  loginAsVisitor: () => void;
  loginWithPassword: (email: string, password: string, role: 'frontdesk' | 'admin') => Promise<string | null>;
  logout: () => Promise<void>;
}

export interface StaffProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'frontdesk';
  createdAt: string;
}

export interface UIState {
  language: Language;
  dir: 'ltr' | 'rtl';
  sidebarOpen: boolean;
  toggleLanguage: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export interface CountryOption {
  value: string;
  label: string;
  flag: string;
}

export interface ExportRow {
  visitorId: string;
  name: string;
  phone: string;
  nationality: string;
  floor: string;
  company: string;
  status: string;
  entryTime: string;
  exitTime: string;
}

export interface StatCardData {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}
