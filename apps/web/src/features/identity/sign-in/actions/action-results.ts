import type { ApiFailure } from '@/lib/api-outcome';
import type { FACTOR_LAPSED } from '../../shared/tools/factor';

/**
 * Sign-in success REDIRECTS (the screen is over), so only failures cross the RSC wire — and the
 * client of a redirecting action observes `undefined` where the redirect won, which the type
 * states rather than leaves to be discovered.
 */
export type SignInFailure = ApiFailure | undefined;

/**
 * What `completeFactorAction` returns. `undefined` is the redirect winning, as it is for
 * `SignInFailure` — success ends the screen. It moved here from the factor vocabulary when that went up
 * to `identity/shared/` (task 92): the vocabulary is both journeys', and this result is S-01's action's.
 */
export type CompleteFactorFailure =
  | ApiFailure
  | { readonly status: typeof FACTOR_LAPSED }
  | undefined;
