import type { AccountEffect } from '@api/modules/identity/account/interfaces/account-store.interface';
import type { Account, NewVerificationToken } from '@api/modules/identity/account/models/account.model';
import type { Session } from '@api/modules/identity/session/models/session.model';
import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type { NewProviderAccount, ProviderIdentity } from '../models/provider-identity.model';

/**
 * The `identity/provider` store — the third instance of the unit-of-work shape `AccountStore`
 * wrote "to be copied", and an Interface Segregation decision: social sign-in composes operations
 * from three tables (accounts, provider identities, sessions), and widening `SessionTransaction`
 * or `AccountTransaction` with provider operations would hand every existing consumer a
 * capability it never calls. The repository behind this may well be one class implementing all
 * three ports; the seams stay separate because the CALLERS are.
 *
 * The atomicity this exists for (P-8): UC-02's registration is account + identity + verification
 * challenge + outbox row + session in ONE transaction — a provider identity without its account,
 * or an account whose challenge was never committed, is a distinct stranding each.
 *
 * `issueVerificationToken` and `emit` carry the account module's exact signatures on purpose:
 * `issueVerificationChallenge` takes a `Pick` of them, which is what lets the provider flow reuse
 * the ONE verification-challenge implementation instead of growing a second (its header explains
 * why two would be a defect).
 */
export interface SocialSignInTransaction {
  /** §12.5.6's throttle window — same semantics as the account and session stores' pair. */
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;

  recordAuthAttempt(key: string, at: Date): Promise<void>;

  /** By the UC-05 matching key — the subject, never the email. */
  findProviderIdentity(provider: SocialProvider, subject: string): Promise<ProviderIdentity | null>;

  findAccountById(accountId: string): Promise<Account | null>;

  findAccountByEmail(email: string): Promise<Account | null>;

  /**
   * Refreshes the recorded assertion facts (email, verified flag) when the provider's claims
   * moved since last sign-in. A plain UPDATE — the identity itself (provider, subject) never
   * changes; a different subject is a different identity.
   */
  refreshProviderAssertion(
    identity: { readonly id: string; readonly assertedEmail: string; readonly emailVerifiedAsserted: boolean },
    at: Date,
  ): Promise<void>;

  /** UC-03's automatic satisfaction: the provider asserted the address verified. */
  markAccountVerified(accountId: string, at: Date): Promise<Account>;

  /** OQ-52's reclaim, exactly as the account store's — cascade takes tokens and identities. */
  deleteAccount(accountId: string): Promise<void>;

  /**
   * UC-02: the account and its provider identity in one decision. Throws
   * `EmailAlreadyRegisteredError` on the unique index for the reason `insertUnverifiedAccount`
   * documents — a read-then-write duplicate check loses the race the index cannot.
   */
  createProviderAccount(account: NewProviderAccount): Promise<Account>;

  /** Same contract as `SessionTransaction.createSession` — the session and its first token together. */
  createSession(accountId: string, refreshTokenHash: Buffer, at: Date): Promise<Session>;

  issueVerificationToken(token: NewVerificationToken): Promise<void>;

  /** The outbox on THIS transaction's runner (AD-6, P-8) — see `AccountTransaction.emit`. */
  emit(effect: AccountEffect): Promise<void>;
}

export interface SocialSignInStore {
  run<T>(work: (tx: SocialSignInTransaction) => Promise<T>): Promise<T>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SOCIAL_SIGN_IN_STORE = Symbol('SOCIAL_SIGN_IN_STORE');
