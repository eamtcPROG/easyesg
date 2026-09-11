import type { ApiOutcome } from '@/lib/api-outcome';
import type { AccountSummary } from '../../shared/tools/account-summary';

/**
 * What the register action returns to its screen: one `ApiOutcome` container (the same shape
 * `postToApi` produced — nothing is re-wrapped on the way through), carrying only the members the
 * screen reads.
 */
export type RegisterResult = ApiOutcome<AccountSummary>;
