import type { AccountResponse } from '@easyesg/contracts';
import type { ApiOutcome } from '@/lib/api-outcome';

/**
 * What each identity action returns to its screen: one `ApiOutcome` container (the same shape
 * `postToApi` produced — nothing is re-wrapped on the way through), carrying only the members
 * the screen reads. The projection down from the wire DTO happens once, in the action, with
 * `mapOutcome`.
 */
export type AccountSummary = Pick<AccountResponse, 'id' | 'email' | 'status'>;

export type RegisterResult = ApiOutcome<AccountSummary>;
export type VerifyResult = ApiOutcome<AccountSummary>;
export type ResendResult = ApiOutcome<null>;
