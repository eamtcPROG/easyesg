import type { ApiOutcome } from '@/lib/api-outcome';
import type { AccountSummary } from '../../shared/tools/account-summary';

/** What the verify journey's two actions return to their screen — see `register/actions/action-results.ts`. */
export type VerifyResult = ApiOutcome<AccountSummary>;
export type ResendResult = ApiOutcome<null>;
