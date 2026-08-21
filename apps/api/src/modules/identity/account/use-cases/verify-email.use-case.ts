import { unverifiedAccountHasExpired } from '../domain/account-expiry';
import { hashVerificationToken, verificationTokenMatches } from '../domain/verification-token';
import { VerificationTokenInvalidError } from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { Account } from '../models/account.model';
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
 */
export interface VerifyEmailCommand {
  /** The single-use value from the verification link. */
  readonly token: string;
}

export class VerifyEmail {
  constructor(
    private readonly store: AccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<Account> {
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
      if (!verificationTokenMatches(presentedHash, claimed.tokenHash)) {
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

      return tx.markAccountVerified(account.id, now);
    });
  }
}
