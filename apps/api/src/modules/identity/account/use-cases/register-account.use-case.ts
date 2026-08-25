import type { Locale } from '@easyesg/i18n';
import { unverifiedAccountHasExpired } from '../domain/account-expiry';
import { emailIdentityKey, normaliseEmail } from '../domain/email-address';
import { passwordMeetsPolicy } from '../domain/password-policy';
import { EmailAlreadyRegisteredError, PasswordPolicyViolationError } from '../errors/account.errors';
import type { AccountStore, AccountTransaction } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import type { Account } from '../models/account.model';
import { issueVerificationChallenge } from './issue-verification-challenge';
import { invitationIsAcceptable } from '@api/modules/identity/invitation/domain/invitation-expiry';
import type { Clock } from '@api/contracts/clock.port';

export interface RegisterAccountCommand {
  readonly email: string;
  readonly password: string;
  /** Negotiated from `Accept-Language` for this request; seeds FR-10's persisted preference. */
  readonly locale: Locale;
  /**
   * An organization invitation the registrant is holding — S-03's "create an account by password"
   * path (UC-15 step 2), optional everywhere else.
   *
   * Presenting a **live** one for **this same address** creates a verified account and issues no
   * challenge (FR-3, §12.5.6's task-26.2 row). Anything else — spent, revoked, lapsed, for another
   * address, or not an invitation at all — is ignored, and registration proceeds exactly as it does
   * without one. It never fails the registration: a stale link is a bad reason to refuse someone an
   * account, and the ordinary verification email is a working way forward.
   */
  readonly invitationToken?: string | null;
}

/**
 * UC-01 — register a user account with email and password (FR-1).
 *
 * Framework-free, as `domain-free-of-frameworks` requires: no `@Injectable`, no TypeORM, no HTTP.
 * `account.module.ts` constructs it with `useFactory`, which is what that constraint costs and is
 * the point of paying it — every branch below is reachable in a unit test with three closures.
 *
 * It reads as UC-01's main success scenario: supply an address and a password, create an unverified
 * record, issue a verification challenge. The challenge is issued as an **outbox row**, not as a
 * send, and that is P-8 rather than a preference — sending inside the transaction is the dual write
 * AD-6 exists to remove, and its failure is concrete: roll back after the send and someone holds a
 * working verification link for an account that does not exist.
 *
 * No entitlement gate (`apps/api/CLAUDE.md`, "before you add a route"): registration precedes every
 * organization, so there is no tenant to hold a plan and nothing for `EntitlementGuard` to read.
 */
export class RegisterAccount {
  constructor(
    private readonly store: AccountStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: RegisterAccountCommand): Promise<Account> {
    const email = normaliseEmail(command.email);

    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();

    // Hashed BEFORE the transaction opens, deliberately. Argon2id at §9.1's parameters is tens of
    // milliseconds of CPU by design, and `poolSize` is 10 (§12.5) — holding a pooled connection
    // through the hash would make registration a throughput ceiling on every other request during
    // the April–May window. Nothing here needs the database.
    const passwordHash = await this.hasher.hash(command.password);

    return this.store.run(async (tx) => {
      const now = this.now();

      // This read exists ONLY for OQ-52's expiry: an unverified account past its window must stop
      // holding the address against the person who registered it, and reclaiming it here is what
      // makes that true without waiting for a sweep. It is NOT the duplicate check — that is the
      // unique index, because two simultaneous registrations of one address would both pass a
      // read-then-write check and one of them would be wrong.
      const existing = await tx.findAccountByEmail(email);
      if (existing) {
        if (!unverifiedAccountHasExpired(existing, now)) throw new EmailAlreadyRegisteredError();
        await tx.deleteAccount(existing.id);
      }

      const account = await tx.insertUnverifiedAccount({
        email,
        locale: command.locale,
        passwordHash,
      });

      // FR-3's third route to a verified account, added 25 Aug 2026 (§12.5.6's task-26.2 row).
      //
      // The reasoning is task 24's, not a new principle: `signInLinked` marks an account verified
      // when a provider vouches for **the account's own address**, and an invitation link is the
      // same proof of mailbox control — it was emailed to that address, and the holder is
      // presenting it. What it buys is concrete: sign-in refuses an unverified account (OQ-57), so
      // without this the invitee registers, waits for a second email, verifies, signs in, and only
      // then can accept — six steps and two emails, the second arriving while they look at a screen
      // telling them to check their inbox.
      //
      // The account is still INSERTED unverified and then marked, rather than created verified.
      // That keeps `insertUnverifiedAccount` the one shape registration has, and it means the
      // `account_verified_at_matches_status` CHECK is satisfied by the same code path in both
      // cases.
      if (await invitationVouchesFor(tx, command.invitationToken, email, now)) {
        return tx.markAccountVerified(account.id, now);
      }

      await issueVerificationChallenge(tx, account, now);

      return account;
    });
  }
}

/**
 * Does the presented token prove control of the address being registered? (FR-3, task 26.2.)
 *
 * A free function taking a `Pick` of the transaction (ISP), because it is one decision made from
 * one read and belongs beside the use case that makes it rather than inside the store — the store
 * returning "yes" would be a second definition of a live invitation.
 *
 * **Both halves reuse what acceptance uses.** `invitationIsAcceptable` is UC-15's own gate, so a
 * spent, revoked or lapsed link vouches for nothing here for exactly the reason it grants nothing
 * there; and `emailIdentityKey` is what `account_email_key` and 26.1's partial index both mean by
 * equality. An invitation for `bob@x.md` cannot verify an account being registered as `ana@x.md`,
 * which is the whole content of FR-11's binding applied one step earlier.
 */
async function invitationVouchesFor(
  tx: Pick<AccountTransaction, 'findPresentedInvitation'>,
  token: string | null | undefined,
  email: string,
  now: Date,
): Promise<boolean> {
  // Truthy, not `=== undefined`, and the difference was a **500**. `@IsOptional()` skips validation
  // for `null` as well as for an absent key, so a client sending `"invitationToken": null` — which
  // is what several HTTP clients emit for an unset optional, and what a hand-written body naturally
  // contains — reached the store and threw inside `createHash().update(null)`. A registration is
  // not the place to answer "no invitation" with an internal error.
  if (!token) return false;

  const invitation = await tx.findPresentedInvitation(token);
  if (invitation === null) return false;

  return (
    invitationIsAcceptable(invitation, now) &&
    emailIdentityKey(invitation.invitedEmail) === emailIdentityKey(email)
  );
}
