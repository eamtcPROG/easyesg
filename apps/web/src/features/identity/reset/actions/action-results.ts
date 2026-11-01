import type { ApiOutcome } from '@/lib/api-outcome';
import type { HeldAccount } from '../../shared/tools/held-account';

/** What the reset journey's two actions return to their screen — see `register/actions/action-results.ts`. */
export type RequestResetResult = ApiOutcome<null>;

/**
 * A reset that went through, and the account this browser still holds afterwards (task 160) — `null` when
 * none, including when the reset ended this browser's own session, which the action has then cleared.
 */
export interface ResetPasswordSuccess {
  readonly heldAccount: HeldAccount | null;
}

export type ResetPasswordResult = ApiOutcome<ResetPasswordSuccess>;
