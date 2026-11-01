import type { ApiOutcome } from '@/lib/api-outcome';
import type { AccountSummary } from '../../shared/tools/account-summary';
import type { HeldAccount } from '../../shared/tools/held-account';

/**
 * The account just confirmed, and the different one this browser is still signed in as, if any (task 160):
 * a signed-in reader who confirms someone else's address is offered to switch or to stay.
 */
export interface VerifiedAccount extends AccountSummary {
  readonly heldAccount: HeldAccount | null;
}

/** What the verify journey's two actions return to their screen — see `register/actions/action-results.ts`. */
export type VerifyResult = ApiOutcome<VerifiedAccount>;
export type ResendResult = ApiOutcome<null>;
