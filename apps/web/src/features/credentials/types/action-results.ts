import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What S-28's writes return (task 27.7).
 *
 * Two shapes, and the split is what each caller actually needs. Most writes answer nothing on
 * success — the screen re-renders from the server through `revalidatePath`, so a returned DTO
 * would be a second, staler copy of what the next render is already fetching (S-16's reasoning).
 *
 * Two of them do carry a value, because it exists **only** at that moment and can never be fetched
 * again: enrolment's secret, and the recovery codes. Modelling them as the same empty shape would
 * mean the screen reading them from somewhere else, and there is nowhere else.
 *
 * Failures travel untouched, as always: the problem document's own three-part text is what the
 * screen renders (NFR-79) — a wrong current password, a last-credential refusal, a spent window.
 */
export type CredentialActionResult = ApiOutcome<null>;

export interface TotpEnrolmentOffer {
  readonly secret: string;
  readonly enrolmentUri: string;
}

/** Shown exactly once, at confirmation or re-issue. The screen must say so before it shows them. */
export interface RecoveryCodes {
  readonly recoveryCodes: readonly string[];
}
