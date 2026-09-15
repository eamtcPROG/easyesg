import type { ApiFailure } from '@/lib/api-outcome';
import type { SETUP_GRANT_LAPSED } from '../tools/password-step';

/**
 * What S-36's password step hears back (task 155) — a refusal, the link path's lapse, or `undefined`
 * because the action's redirect won. Success never returns: the screen ends, as sign-in's does.
 */
export type PasswordStepFailure =
  | ApiFailure
  | { readonly status: typeof SETUP_GRANT_LAPSED }
  | undefined;

/** What the name-and-language step hears back — a refusal, or `undefined` because the redirect won. */
export type ProfileStepFailure = ApiFailure | undefined;
