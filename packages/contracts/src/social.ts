/**
 * Social sign-in's wire vocabularies (FR-2, FR-4; task 24) — the consumer-side declarations of
 * values `apps/api` derives from its own `SOCIAL_PROVIDER` and `SOCIAL_SIGN_IN_INTENT` objects.
 * Two copies for `PROBLEM_TYPE`'s stated reason: the api produces this package and must never
 * import it, so this is a mirror changed together with its source by hand — and the OpenAPI
 * enums generated from the api's copy are what the diff gate holds both against.
 */

/** FR-2's MVP providers. The path parameter of `/auth/social/{provider}/…`. */
export const SOCIAL_PROVIDER = {
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
} as const;

export type SocialProvider = (typeof SOCIAL_PROVIDER)[keyof typeof SOCIAL_PROVIDER];

export const isSocialProvider = (value: string): value is SocialProvider =>
  (Object.values(SOCIAL_PROVIDER) as string[]).includes(value);

/**
 * What the user was doing when the flow began — decides UC-05's alternate (a sign-in matching
 * nothing is OFFERED registration) against UC-02's main path (a registration registers).
 */
export const SOCIAL_SIGN_IN_INTENT = {
  SIGN_IN: 'sign-in',
  REGISTER: 'register',
} as const;

export type SocialSignInIntent = (typeof SOCIAL_SIGN_IN_INTENT)[keyof typeof SOCIAL_SIGN_IN_INTENT];

export const isSocialSignInIntent = (value: string): value is SocialSignInIntent =>
  (Object.values(SOCIAL_SIGN_IN_INTENT) as string[]).includes(value);
