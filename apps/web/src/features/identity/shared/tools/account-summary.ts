import type { AccountResponse } from '@easyesg/contracts';

/**
 * The members of an account the identity screens read, and the projection down from the wire DTO.
 *
 * **In `shared/tools/` on one test: read by more than one journey.** `register/` and `verify/` both
 * answer with an account summary — the same projection, done once in each action with `mapOutcome`.
 */
export type AccountSummary = Pick<AccountResponse, 'id' | 'email' | 'status'>;

export const toAccountSummary = ({ id, email, status }: AccountResponse): AccountSummary => ({
  id,
  email,
  status,
});
