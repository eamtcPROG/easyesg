import type { Locale } from '@easyesg/i18n';
import type { SocialProvider } from '@api/contracts/identity-provider.port';

/**
 * A provider identity as it crosses the store port (FR-2, FR-4, FR-8) — the FR data inventory's
 * row: provider, subject identifier, asserted email, asserted-verified flag. Not a TypeORM entity
 * (AD-14 constraint 1). Instants are `Date`; epoch-ms is the wire's representation (OQ-50).
 */
export interface ProviderIdentity {
  readonly id: string;
  readonly accountId: string;
  readonly provider: SocialProvider;
  readonly subject: string;
  /**
   * The address the provider asserted at the LAST sign-in — a recorded fact, deliberately not an
   * identity and deliberately allowed to drift from `account.email`: UC-05 matches on the subject
   * precisely because this can change under the user at the provider.
   */
  readonly assertedEmail: string;
  readonly emailVerifiedAsserted: boolean;
}

/**
 * What the browser was doing when the flow began — S-01 has a sign-in surface and a register
 * surface over the same buttons, and UC-05's alternate flow turns on the difference: a
 * sign-in-intent arrival with no matching account is OFFERED registration, never silently given
 * an empty account. Carried in the web tier's sealed transaction cookie, asserted back to the
 * completion endpoint.
 */
export const SOCIAL_SIGN_IN_INTENT = {
  SIGN_IN: 'sign-in',
  REGISTER: 'register',
} as const;

export type SocialSignInIntent = (typeof SOCIAL_SIGN_IN_INTENT)[keyof typeof SOCIAL_SIGN_IN_INTENT];

/**
 * What social registration hands the store (UC-02): the account and its provider identity are one
 * insert decision — FR-2's "the same account record with the provider identity as its credential
 * and no password set". `verifiedAt` non-null means the provider asserted the address verified,
 * which is UC-03 satisfied without a separate email.
 */
export interface NewProviderAccount {
  readonly email: string;
  readonly locale: Locale;
  readonly provider: SocialProvider;
  readonly subject: string;
  readonly assertedEmail: string;
  readonly emailVerifiedAsserted: boolean;
  readonly verifiedAt: Date | null;
}
