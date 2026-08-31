import type { LegalDate } from '@easyesg/contracts';

/**
 * The one place a calendar date becomes a **legal** one (NFR-34, task 32.1.2).
 *
 * Every date this product files against is `{ date, timezone }`, and `LegalDateDto`'s own comment
 * says why the pairing is an object: *"so the zone cannot be forgotten"* — two sibling fields are
 * two strings a caller can half-supply. This module is that guarantee on the screen side, where the
 * control emits only the date half by design (`DateField`'s header explains why `packages/ui` may
 * not read an ambient fact).
 *
 * **The zone is the reporter's browser** (`architecture.md` §12.5.6's task-32.1 row, project owner,
 * 31 Aug 2026). Two things about that decision belong here, where somebody will meet them:
 *
 * - **It is not the recommendation that was on record**, which was to derive the zone from the
 *   organization's country. NFR-34's own test is *would a different timezone change the answer to a
 *   legal question*, and a fiscal year is determined by the jurisdiction the undertaking files in
 *   rather than by where its bookkeeper is sitting.
 * - **So the accepted cost is real and worth stating at the call site**: a reporter working from
 *   another country records a period boundary in *their* zone, not the filing's — the exact failure
 *   NFR-34 exists to prevent, admitted at the one boundary NFR-34 does not reach. Reversing it is
 *   this function plus a backfill of whatever periods exist by then, which is cheap now and dearer
 *   every filing season.
 */

/**
 * The zone the platform will record against dates this reporter enters.
 *
 * `Intl` is available in every browser and on the Node server tier, and it answers an IANA name —
 * the same vocabulary the API's `*_tz` columns store. It can throw in a locked-down runtime, so the
 * fallback is explicit rather than an optional chain: **UTC is a real answer**, and a period stored
 * against UTC is wrong in a way somebody can find, where an empty string is refused by a `CHECK`
 * and reads to the reporter as a form that will not submit.
 */
export function reporterTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Pair an ISO `YYYY-MM-DD` with the reporter's zone.
 *
 * Takes the date only, because that is what a `DateField` emits — and returns `null` for an empty
 * one, so an optional date (FR-21's due date) stays optional without every caller writing the same
 * ternary. An absent due date is a real state: it is what deadline notices count down to, and a
 * period may legitimately have none.
 */
export function legalDate(date: string | null | undefined): LegalDate | null {
  if (!date) return null;
  return { date, timezone: reporterTimezone() };
}

/**
 * The date half, for populating a `DateField` from a stored period.
 *
 * The inverse of `legalDate`, and deliberately **lossy**: the control shows a calendar day and the
 * zone travels beside it, so a form that read the zone back into a field would offer the reporter a
 * value they cannot edit. On save the zone is resolved fresh — which is the same rule as on create,
 * and means an edit made from a different country moves the zone with it. That follows from the
 * decision above rather than softening it.
 */
export function dateValue(legal: LegalDate | null | undefined): string {
  return legal?.date ?? '';
}
