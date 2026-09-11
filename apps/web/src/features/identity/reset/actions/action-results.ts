import type { ApiOutcome } from '@/lib/api-outcome';

/** What the reset journey's two actions return to their screen — see `register/actions/action-results.ts`. */
export type RequestResetResult = ApiOutcome<null>;
export type ResetPasswordResult = ApiOutcome<null>;
