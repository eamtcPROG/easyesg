import type { Locale } from '@easyesg/i18n';
import { unverifiedAccountHasExpired } from '../domain/account-expiry';
import { normaliseEmail } from '../domain/email-address';
import { passwordMeetsPolicy } from '../domain/password-policy';
import { EmailAlreadyRegisteredError, PasswordPolicyViolationError } from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import type { Account } from '../models/account.model';
import { issueVerificationChallenge } from './issue-verification-challenge';
import type { Clock } from '@api/contracts/clock.port';

export interface RegisterAccountCommand {
  readonly email: string;
  readonly password: string;
  /** Negotiated from `Accept-Language` for this request; seeds FR-10's persisted preference. */
  readonly locale: Locale;
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

      await issueVerificationChallenge(tx, account, now);

      return account;
    });
  }
}
