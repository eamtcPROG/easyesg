import type { SeatConsumption } from '@easyesg/contracts';
import { USAGE_STANDING, type UsageStanding } from '@easyesg/ui';

/**
 * S-16's seat region, read off the two numbers the API answers (task 142; UX-50, UX-52).
 *
 * **Pure, and computed once, in the section** (`section-compute-once`): the counter in the heading
 * and the invite panel below must agree about whether the organization is full, and two derivations
 * of that are two places for them not to. `AccessSection` calls this and passes the result to both.
 *
 * **The API is still the authority.** Hiding the form at the ceiling is this screen not *offering*
 * an invitation it knows will be refused — `isLastAdministrator`'s rule applied to seats — and the
 * refusal stays authoritative, because between the render and the press someone may have been
 * invited from another tab.
 */

/** The standings a readable ceiling can be in — derived, so a standing added to the vocabulary lands here. */
export type KnownSeatStanding = Exclude<UsageStanding, typeof USAGE_STANDING.UNKNOWN>;

/**
 * **A union rather than a nullable `limit`**, for `AccessRow`'s reason: with no readable ceiling
 * there is no limit and nothing remaining — questions that do not apply, not values that are absent
 * — so the part that draws the gate cannot be handed a region it would have to null-check.
 */
export type SeatRegion =
  | { readonly standing: typeof USAGE_STANDING.UNKNOWN; readonly used: number }
  | KnownSeatRegion;

export interface KnownSeatRegion {
  readonly standing: KnownSeatStanding;
  readonly used: number;
  readonly limit: number;
  /** Never negative: an organization over its ceiling — one that lowered it — has none left. */
  readonly remaining: number;
}

/**
 * UX-52's warning shows when **one** seat remains — the threshold the S-13 and S-17 artboards draw as
 * *"one left"*, and the one S-16's states record (13 Sep 2026).
 */
const APPROACHING_WHEN_REMAINING = 1;

export const seatRegion = (seats: SeatConsumption): SeatRegion => {
  if (seats.allowance === null) return { standing: USAGE_STANDING.UNKNOWN, used: seats.used };

  const remaining = Math.max(seats.allowance - seats.used, 0);
  let standing: KnownSeatStanding = USAGE_STANDING.WITHIN;
  if (remaining === 0) standing = USAGE_STANDING.REACHED;
  else if (remaining === APPROACHING_WHEN_REMAINING) standing = USAGE_STANDING.APPROACHING;

  return { standing, used: seats.used, limit: seats.allowance, remaining };
};
