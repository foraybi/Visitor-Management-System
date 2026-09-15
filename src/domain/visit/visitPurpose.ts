/**
 * Why a visitor came in, chosen from a fixed list at the tablet.
 *
 * Stored as a key rather than the Arabic sentence, so the label can be shown in
 * either language and reworded later without rewriting past visits. The same
 * list is checked by the kiosk API and by the database.
 */

export const VISIT_PURPOSES = [
  'mentor_consultation',
  'job_interview',
  'innovation_center_company',
  'startup_complex_company',
  'meeting',
  'other',
] as const;

export type VisitPurpose = (typeof VISIT_PURPOSES)[number];

export function isVisitPurpose(value: unknown): value is VisitPurpose {
  return typeof value === 'string' && (VISIT_PURPOSES as readonly string[]).includes(value);
}

/** The i18n key for a purpose's label. */
export function visitPurposeLabelKey(purpose: VisitPurpose): string {
  return `visitor.purpose.${purpose}`;
}
