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
  // ── FR-8's link and unlink (UC-11, UC-12; task 27.6) ────────────────────────────────────────

  /** Every provider identity on an account, for S-28's list and for BR-ID-4's count. */
  findProviderIdentitiesFor(accountId: string): Promise<ProviderIdentity[]>;

  /**
   * Whether the account holds a password row — BR-ID-4's other credential kind.
   *
   * **Deliberately separate from `findPasswordDigest` below, and not derived from it.** The rule
   * needs a count, not a secret; a boolean caller that received a hash would be handling a
   * credential it has no use for, and the two methods keep that impossible rather than merely
   * unwise (ISP, and §9.1's stance that a hash has no reader outside authentication).
   */
  hasPasswordCredential(accountId: string): Promise<boolean>;

  /** The Argon2id digest, for re-authentication only. `null` is a provider-only account (FR-2). */
  findPasswordDigest(accountId: string): Promise<string | null>;

  /**
   * Attaches an asserted identity to an existing account (UC-11).
   *
   * **False when the `(provider, subject)` pair is already taken**, by this account or another —
   * the unique index decides it, not a prior read, for `insertUnverifiedAccount`'s reason: two
   * simultaneous links of one Google account to two easyesg accounts both pass a read-then-write
   * check and one of them is wrong. The caller reports the refusal without saying which case it
   * was, since "that Google account is already linked to somebody" names a stranger's account.
   */
  linkProviderIdentity(
    identity: {
      readonly accountId: string;
      readonly provider: SocialProvider;
      readonly subject: string;
      readonly assertedEmail: string;
      readonly emailVerifiedAsserted: boolean;
    },
    at: Date,
  ): Promise<boolean>;

  /**
   * Removes the account's identity for one provider (UC-12), answering whether there was one.
   *
   * BR-ID-4 is **not** checked here: the count and the delete must be one decision, and the caller
   * makes it inside this transaction. A store method that refused on its own would be a second
   * place the rule lives.
   */
  unlinkProviderIdentity(
    identity: { readonly accountId: string; readonly provider: SocialProvider },
  ): Promise<boolean>;

  emit(effect: AccountEffect): Promise<void>;
}

export interface SocialSignInStore {
  run<T>(work: (tx: SocialSignInTransaction) => Promise<T>): Promise<T>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SOCIAL_SIGN_IN_STORE = Symbol('SOCIAL_SIGN_IN_STORE');
