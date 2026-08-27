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
 * BR-ID-4's inputs, counted rather than assumed (task 27.6).
 *
 * The rule is *the last remaining credential cannot be removed*, and a credential is either kind:
 * the password row, or a provider identity. Refusing to unlink "the only provider" would be a
 * different and wrong rule — an account with a password and one provider may unlink it, and a
 * provider-only account with two may unlink one.
 *
 * UC-12 states what the refusal prevents, and it is worse than a locked-out user: an account with
 * no usable credential is unrecoverable **and takes its organization memberships down with it**.
 */
export interface CredentialInventory {
  readonly hasPassword: boolean;
  readonly providers: readonly SocialProvider[];
}

/** True when removing `provider` would leave the account with no way back in (BR-ID-4). */
export const isLastCredential = (
  inventory: CredentialInventory,
  provider: SocialProvider,
): boolean =>
  !inventory.hasPassword && inventory.providers.filter((held) => held !== provider).length === 0;

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
  /**
   * UC-11, added by task 27.6. The flow begins on S-28 rather than S-01 and completes at
   * `/account/providers/{provider}` instead of `/auth/social/{provider}/session` — so the web
   * tier's sealed transaction has to carry which of the two it was, and this is what it carries.
   * The *authorization* half is identical; only the completion differs.
   */
  LINK: 'link',
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
