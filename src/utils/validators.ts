import { z } from 'zod';

const saudiPhoneRegex = /^05\d{8}$/;

export const personalInfoSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .regex(saudiPhoneRegex, 'Phone must start with 05 and be exactly 10 digits'),
  nationalityType: z.enum(['national_id', 'iqama', 'passport']),
  nationalityIdNumber: z.string().min(5, 'ID number is required'),
  countryCode: z.string().min(2, 'Please select a country'),
});

export const visitInfoSchema = z.object({
  visitorType: z.enum(['visitor', 'employee']),
  visitedCompanyId: z.string().min(1, 'Please select a company'),
  floor: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const enterFormSchema = personalInfoSchema
  .merge(visitInfoSchema)
  .extend({
    signatureDataUrl: z.string().min(1, 'Signature is required'),
  });

export const exitFormSchema = z.object({
  visitorId: z
    .string()
    .regex(/^VST-\d{3,}$/, 'Invalid visitor ID format (e.g. VST-001)'),
});
