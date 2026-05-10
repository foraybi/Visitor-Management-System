import type { CountryOption } from '../types';

export interface Country {
  value: string;
  label: string;
  labelAr: string;
  flag: string;
}

export const countries: Country[] = [
  { value: 'SA', label: 'Saudi Arabia', labelAr: 'المملكة العربية السعودية', flag: '🇸🇦' },
  { value: 'AE', label: 'United Arab Emirates', labelAr: 'الإمارات العربية المتحدة', flag: '🇦🇪' },
  { value: 'KW', label: 'Kuwait', labelAr: 'الكويت', flag: '🇰🇼' },
  { value: 'QA', label: 'Qatar', labelAr: 'قطر', flag: '🇶🇦' },
  { value: 'BH', label: 'Bahrain', labelAr: 'البحرين', flag: '🇧🇭' },
  { value: 'OM', label: 'Oman', labelAr: 'عُمان', flag: '🇴🇲' },
  { value: 'YE', label: 'Yemen', labelAr: 'اليمن', flag: '🇾🇪' },
  { value: 'JO', label: 'Jordan', labelAr: 'الأردن', flag: '🇯🇴' },
  { value: 'SY', label: 'Syria', labelAr: 'سوريا', flag: '🇸🇾' },
  { value: 'LB', label: 'Lebanon', labelAr: 'لبنان', flag: '🇱🇧' },
  { value: 'EG', label: 'Egypt', labelAr: 'مصر', flag: '🇪🇬' },
  { value: 'PS', label: 'Palestine', labelAr: 'فلسطين', flag: '🇵🇸' },
  { value: 'IQ', label: 'Iraq', labelAr: 'العراق', flag: '🇮🇶' },
  { value: 'IR', label: 'Iran', labelAr: 'إيران', flag: '🇮🇷' },
  { value: 'US', label: 'United States', labelAr: 'الولايات المتحدة', flag: '🇺🇸' },
  { value: 'GB', label: 'United Kingdom', labelAr: 'المملكة المتحدة', flag: '🇬🇧' },
  { value: 'DE', label: 'Germany', labelAr: 'ألمانيا', flag: '🇩🇪' },
  { value: 'FR', label: 'France', labelAr: 'فرنسا', flag: '🇫🇷' },
  { value: 'IT', label: 'Italy', labelAr: 'إيطاليا', flag: '🇮🇹' },
  { value: 'ES', label: 'Spain', labelAr: 'إسبانيا', flag: '🇪🇸' },
  { value: 'IN', label: 'India', labelAr: 'الهند', flag: '🇮🇳' },
  { value: 'PK', label: 'Pakistan', labelAr: 'باكستان', flag: '🇵🇰' },
  { value: 'BD', label: 'Bangladesh', labelAr: 'بنغلاديش', flag: '🇧🇩' },
  { value: 'PH', label: 'Philippines', labelAr: 'الفلبين', flag: '🇵🇭' },
  { value: 'TH', label: 'Thailand', labelAr: 'تايلاند', flag: '🇹🇭' },
  { value: 'CN', label: 'China', labelAr: 'الصين', flag: '🇨🇳' },
  { value: 'JP', label: 'Japan', labelAr: 'اليابان', flag: '🇯🇵' },
  { value: 'SG', label: 'Singapore', labelAr: 'سنغافورة', flag: '🇸🇬' },
  { value: 'MY', label: 'Malaysia', labelAr: 'ماليزيا', flag: '🇲🇾' },
  { value: 'AU', label: 'Australia', labelAr: 'أستراليا', flag: '🇦🇺' },
  { value: 'NZ', label: 'New Zealand', labelAr: 'نيوزيلندا', flag: '🇳🇿' },
  { value: 'CA', label: 'Canada', labelAr: 'كندا', flag: '🇨🇦' },
  { value: 'MX', label: 'Mexico', labelAr: 'المكسيك', flag: '🇲🇽' },
  { value: 'BR', label: 'Brazil', labelAr: 'البرازيل', flag: '🇧🇷' },
];

export function getCountryLabel(code: string, lang: 'en' | 'ar' = 'en'): string {
  const country = countries.find(c => c.value === code);
  if (!country) return code;
  return lang === 'ar' ? country.labelAr : country.label;
}

// Keep for backwards compat with CountryOption type
export const countryOptions: CountryOption[] = countries.map(c => ({
  value: c.value,
  label: c.label,
  flag: c.flag,
}));
