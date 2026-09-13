import { createClient } from '@supabase/supabase-js';
import type { Visitor, Company, Employee, FloorInfo } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Primary client — used for all app operations and auth sessions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// ---- DB row types (snake_case from Supabase) ----

type VisitorRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationality_type: string;
  nationality_id_number: string;
  country_code: string;
  country_name: string;
  visitor_type: string;
  visited_company_id: string;
  floor: number;
  signature_data_url: string;
  entry_time: string;
  exit_time: string | null;
  status: string;
  date: string;
};

type EmployeeRow = {
  id: string;
  company_id: string;
  employee_number: string;
  name: string;
  name_ar: string;
  phone: string;
  email: string | null;
  nationality_type: string;
  nationality_id_number: string;
  country_code: string;
  gender: string;
  employment_status: string;
  job_type: string;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  photo_data_url: string | null;
  notes: string | null;
  verification_status: string;
};

type CompanyRow = {
  id: string;
  name: string;
  name_ar: string;
  logo_url: string | null;
  phone: string;
  floor: number;
  employee_count: number;
  employees?: EmployeeRow[];
};

type FloorRow = {
  id: string;
  number: number;
  name: string;
  name_ar: string;
  image_url: string | null;
};

// ---- DB → App type converters ----

export function toVisitor(row: VisitorRow): Visitor {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    nationalityType: row.nationality_type as Visitor['nationalityType'],
    nationalityIdNumber: row.nationality_id_number,
    countryCode: row.country_code,
    countryName: row.country_name,
    visitorType: row.visitor_type as Visitor['visitorType'],
    visitedCompanyId: row.visited_company_id,
    floor: row.floor,
    signatureDataUrl: row.signature_data_url,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    status: row.status as Visitor['status'],
    date: row.date,
  };
}

export function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeNumber: row.employee_number,
    name: row.name,
    nameAr: row.name_ar,
    phone: row.phone,
    email: row.email ?? undefined,
    nationalityType: row.nationality_type as Employee['nationalityType'],
    nationalityIdNumber: row.nationality_id_number,
    countryCode: row.country_code,
    gender: row.gender as Employee['gender'],
    employmentStatus: row.employment_status as Employee['employmentStatus'],
    jobType: row.job_type as Employee['jobType'],
    department: row.department ?? undefined,
    position: row.position ?? undefined,
    hireDate: row.hire_date ?? undefined,
    photoDataUrl: row.photo_data_url ?? undefined,
    notes: row.notes ?? undefined,
    verificationStatus: row.verification_status as Employee['verificationStatus'],
  };
}

export function toCompany(row: CompanyRow): Company {
  const employees = (row.employees ?? []).map(toEmployee);
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    logoUrl: row.logo_url ?? '',
    phone: row.phone,
    floor: row.floor,
    employeeCount: employees.length,
    employees,
  };
}

export function toFloor(row: FloorRow): FloorInfo {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    nameAr: row.name_ar,
    imageUrl: row.image_url ?? '',
  };
}

// ---- App type → DB row converters ----

export function fromVisitor(v: Visitor) {
  return {
    id: v.id,
    name: v.name,
    phone: v.phone,
    email: v.email ?? null,
    nationality_type: v.nationalityType,
    nationality_id_number: v.nationalityIdNumber,
    country_code: v.countryCode,
    country_name: v.countryName,
    visitor_type: v.visitorType,
    visited_company_id: v.visitedCompanyId,
    floor: v.floor,
    signature_data_url: v.signatureDataUrl,
    entry_time: v.entryTime,
    exit_time: v.exitTime,
    status: v.status,
    date: v.date,
  };
}

export function fromEmployee(e: Employee, companyId: string) {
  return {
    id: e.id,
    company_id: companyId,
    employee_number: e.employeeNumber,
    name: e.name,
    name_ar: e.nameAr,
    phone: e.phone,
    email: e.email ?? null,
    nationality_type: e.nationalityType,
    nationality_id_number: e.nationalityIdNumber,
    country_code: e.countryCode,
    gender: e.gender,
    employment_status: e.employmentStatus,
    job_type: e.jobType,
    department: e.department ?? null,
    position: e.position ?? null,
    hire_date: e.hireDate ?? null,
    photo_data_url: e.photoDataUrl ?? null,
    notes: e.notes ?? null,
    verification_status: e.verificationStatus,
  };
}

export function fromCompany(c: { id: string } & Omit<Company, 'id' | 'employees' | 'employeeCount'>) {
  return {
    id: c.id,
    name: c.name,
    name_ar: c.nameAr,
    logo_url: c.logoUrl || null,
    phone: c.phone,
    floor: c.floor,
    employee_count: 0,
  };
}

export function fromFloor(f: FloorInfo) {
  return {
    id: f.id,
    number: f.number,
    name: f.name,
    name_ar: f.nameAr,
    image_url: f.imageUrl || null,
  };
}

// Storage helpers live in src/data/storage.ts. Files are stored by object path,
// not URL, so rows stay valid when the app moves to a self-hosted server.
