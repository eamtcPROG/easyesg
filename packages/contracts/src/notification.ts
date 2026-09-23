import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * FR-169's one-click unsubscribe (task 52.2.2) — the api's `UNSUBSCRIBE_STANDING`
 * (`src/modules/platform/notification/models/unsubscribe.model.ts`), mirrored for S-38, which draws one arm per
 * standing and cannot branch on wording. A copy changed with its source by hand, for `PROBLEM_TYPE`'s reason, and
 * **held to the generated enum at compile time** as `SUPPORT_ACCESS_STATE` is.
 */
export const UNSUBSCRIBE_STANDING = {
  /** The category still reaches the person by email, and the link can switch it off. */
  AVAILABLE: 'available',
  /** It no longer does — from this link before, or from the profile. */
  SWITCHED_OFF: 'switched_off',
  /** The link can switch nothing off. */
  UNUSABLE: 'unusable',
} as const;

export type UnsubscribeStanding = (typeof UNSUBSCRIBE_STANDING)[keyof typeof UNSUBSCRIBE_STANDING];

export const UNSUBSCRIBE_STANDING_MIRRORS_WIRE: SameSet<
  UnsubscribeStanding,
  components['schemas']['UnsubscribeResponseDto']['standing']
> = true;
