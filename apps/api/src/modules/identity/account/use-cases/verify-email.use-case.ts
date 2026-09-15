import { setupDeadlineFor, unverifiedAccountHasExpired } from '../domain/account-expiry';
import { issueAccountSetupGrant } from '../domain/password-reset-token';
import { hashVerificationToken, verificationTokenMatches } from '../domain/verification-token';
import { VerificationTokenInvalidError } from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import { PASSWORD_RESET_TOKEN_PURPOSE, type Account } from '../models/account.model';
import type { Clock } from '@api/contracts/clock.port';

/**
 * UC-03 — verify email address (FR-3).
 *
 * Every failure below raises the **same** error, and that is the design rather than laziness.
 * Separating "no such token" from "already used" from "expired" would answer, on an unauthenticated
 * endpoint, questions the caller is not entitled to ask; and the reader's next action is identical
 * in all of them — the link no longer works, request another. NFR-79's three parts are in the
 * catalogue entry, not in a branch here.
 *
 * **Order matters once**: the token is claimed before anything else is read. The claim is the
 * atomic gate — checking first and consuming afterwards would reopen exactly the read-then-write
 * window the conditional UPDATE closes, and the window is as wide as a double-clicked link.
 * Rejections after the claim roll it back with the rest of the transaction, which is correct: a
 * token rejected for expiry is no more usable un-claimed than claimed.
 *
 * **Two outcomes since task 155** (§12.5.6's task-155 row (4)). An account holding a password is
 * activated, as it always was. One holding none is a provider registration whose provider did not
 * assert the address: it enters setup rather than `active`, and the link it has just consumed opens
 * its password step — a single-use grant, answered in the response with its expiry, that lasts a
 * quarter-hour.
 */
export interface VerifyEmailCommand {
  /** The single-use value from the verification link. */
  readonly token: string;
}

/** What a consumed confirmation link produced. */
export interface EmailVerified {
  readonly account: Account;
  /**
   * For an account holding no password, the grant that sets its first password and signs it in
   * (task 155). Null for every other account, which is active and signs in as before.
   */
  readonly setupGrant: string | null;
  /** When that grant stops working — null exactly when there is none. */
  readonly setupGrantExpiresAt: Date | null;
}

export class VerifyEmail {
  constructor(
    private readonly store: AccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<EmailVerified> {
    const presentedToken = command.token;
    const presentedHash = hashVerificationToken(presentedToken);

    return this.store.run(async (tx) => {
      const now = this.now();

      // Atomic claim, not find-then-mark. Two requests carrying one link both see `consumed_at IS
      // NULL` under a read-then-write; only a conditional UPDATE decides it once (see the port).
      const claimed = await tx.claimVerificationToken(presentedHash, now);
      if (!claimed) throw new VerificationTokenInvalidError();

      // NFR-64 asks for a constant-time comparison in terms. The claim above already matched on
      // the hash, so this cannot fail in practice — it is here because the requirement says so,
      // it costs one comparison, and it keeps the property true if the lookup is ever rewritten
      // to fetch a candidate and compare in application code.
      if (!verificationTokenMatches({ presented: presentedHash, stored: claimed.tokenHash })) {
        throw new VerificationTokenInvalidError();
      }

      // §12.5.6: 24 h. Consumed above regardless, so an expired link cannot be replayed.
      if (claimed.expiresAt.getTime() <= now.getTime()) throw new VerificationTokenInvalidError();

      const account = await tx.findAccountById(claimed.accountId);
      // Unreachable through the foreign key and its cascade; kept because "unreachable" is a claim
      // about today's schema, and the alternative is a null dereference on the account this whole
      // flow exists to activate.
      if (!account) throw new VerificationTokenInvalidError();

      // OQ-52. The account is not deleted here even though this is where its expiry is noticed:
      // the throw rolls this transaction back, so the delete would not survive it, and
      // registration already reclaims an expired record when the address is next used. Reclaiming
      // rows is the Phase 6 sweep's job; refusing to activate one is this method's.
      if (unverifiedAccountHasExpired(account, now)) throw new VerificationTokenInvalidError();

      if ((await tx.findCredential(account.id)) !== null) {
        return {
          account: await tx.markAccountVerified(account.id, now),
          setupGrant: null,
          setupGrantExpiresAt: null,
        };
      }

      // Task 155. The deadline is the one registration set — seven days from then, not from now —
      // and outstanding reset links are retired first, so the grant is the account's one live
      // challenge (the reset flow's rule, since the grant lives in the same table).
      const inSetup = await tx.enterAccountSetup(
        { accountId: account.id, expiresAt: setupDeadlineFor(account) },
        now,
      );
      const grant = issueAccountSetupGrant(now);
      await tx.invalidateOutstandingPasswordResetTokens(account.id, now);
      await tx.issuePasswordResetToken({
        accountId: account.id,
        tokenHash: grant.hash,
        expiresAt: grant.expiresAt,
        purpose: PASSWORD_RESET_TOKEN_PURPOSE.ACCOUNT_SETUP,
      });

      return { account: inSetup, setupGrant: grant.value, setupGrantExpiresAt: grant.expiresAt };
    });
  }
}
