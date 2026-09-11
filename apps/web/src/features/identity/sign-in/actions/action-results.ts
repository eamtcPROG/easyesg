import type { ApiFailure } from '@/lib/api-outcome';

/**
 * Sign-in success REDIRECTS (the screen is over), so only failures cross the RSC wire — and the
 * client of a redirecting action observes `undefined` where the redirect won, which the type
 * states rather than leaves to be discovered.
 */
export type SignInFailure = ApiFailure | undefined;
