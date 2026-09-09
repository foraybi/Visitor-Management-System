import { create } from 'zustand';
import { httpKioskGateway } from '../../data/kioskGateway';
import type {
  CheckInRequest,
  CheckInSuccess,
  Directory,
  DirectoryCompany,
  DirectoryFloor,
  DirectoryFormField,
  EmployeeMatch,
  KioskError,
  KioskGateway,
  KioskResult,
} from '../../data/kioskGateway';
import type { IdentityType } from '../../domain/identity/identity';

/**
 * The tablet's only state.
 *
 * Replaces four Supabase-backed stores that the kiosk used to load at boot:
 * every visitor ever recorded, every company with its full employee roster,
 * every floor, and the form configuration. The kiosk rendered a company picker
 * and a form. It now holds exactly that.
 *
 * Nothing here imports the Supabase client, which is what keeps the project URL
 * and the publishable key out of the tablet bundle. The build gate in
 * scripts/verify-kiosk-build.sh fails if either reappears.
 */

interface KioskState {
  companies: DirectoryCompany[];
  floors: DirectoryFloor[];
  formFields: DirectoryFormField[] | null;

  /** Null until the first load has been attempted. */
  directoryError: KioskError | null;
  directoryLoaded: boolean;

  loadDirectory: () => Promise<void>;
  lookupEmployee: (
    idType: IdentityType,
    idNumber: string,
  ) => Promise<KioskResult<EmployeeMatch | null>>;
  checkIn: (request: CheckInRequest) => Promise<KioskResult<CheckInSuccess>>;
  checkOut: (visitCode: string) => Promise<KioskResult<{ name: string }>>;
}

/** Swappable so tests can drive the screens through the in-memory adapter. */
let gateway: KioskGateway = httpKioskGateway();

export function setKioskGateway(next: KioskGateway): void {
  gateway = next;
}

export const useKioskStore = create<KioskState>()((set) => ({
  companies: [],
  floors: [],
  formFields: null,
  directoryError: null,
  directoryLoaded: false,

  loadDirectory: async () => {
    const result = await gateway.directory();
    if (!result.ok) {
      // Keep whatever was already loaded. A dropped network should leave the
      // last known company list on screen rather than emptying the picker.
      set({ directoryError: result.error, directoryLoaded: true });
      return;
    }
    const value: Directory = result.value;
    set({
      companies: value.companies,
      floors: value.floors,
      formFields: value.formFields,
      directoryError: null,
      directoryLoaded: true,
    });
  },

  lookupEmployee: (idType, idNumber) => gateway.lookupEmployee(idType, idNumber),
  checkIn: (request) => gateway.checkIn(request),
  checkOut: (visitCode) => gateway.checkOut(visitCode),
}));

/**
 * Whether a check-in field is shown.
 *
 * Defaults to visible, matching the form's previous behaviour when the
 * configuration row was missing.
 */
export function useKioskFieldVisible(): (key: string) => boolean {
  const fields = useKioskStore((s) => s.formFields);
  return (key: string) => fields?.find((f) => f.key === key)?.visible ?? true;
}

/**
 * The i18n key for the message a visitor sees when an operation fails.
 *
 * Every failure is shown. The previous code logged errors to a console nobody
 * was watching and carried on as if the write had succeeded.
 */
export function kioskErrorKey(error: KioskError): string {
  return `visitor.errors.${error}`;
}
