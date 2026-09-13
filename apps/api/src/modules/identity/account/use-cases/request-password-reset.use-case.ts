import { admitAuthAttempt, passwordResetThrottleKey } from '../domain/auth-throttle';
import { normaliseEmail } from '../domain/email-address';
import { issuePasswordResetToken } from '../domain/password-reset-token';
import { AuthRateLimitedError } from '../errors/account.errors';
import type { AccountStore, AccountTransaction } from '../interfaces/account-store.interface';
import { ACCOUNT_STATUS } from '../models/account.model';
import {
  PASSWORD_RESET_REQUESTED,
  type PasswordResetRequested,
} from '../constants/account.constants';
import type { Clock } from '@api/contracts/clock.port';

export interface RequestPasswordResetCommand {
  readonly email: string;
  /** For §12.5.6's per-(IP, account) window, like sign-in. */
  readonly clientIp?: string;
}

/**
 * UC-08 — request a password reset (FR-6).
 *
 * The uniform endpoint par excellence: NFR-64 cites FR-6 by name, so beyond the rate limit —
 * which keys on the request, not on whether an account exists — every path answers the same
 * `202` nothing. Where `ResendVerificationEmail` proves the address UNVERIFIED before mailing,
 * this proves it VERIFIED:
 *
 *  - **No account, or an unverified one** (its OQ-52 expiry included — an unverified account
 *    past the window is no account at all): nothing is issued and nothing is sent. A reset link
 *    is proof of address control being exchanged for a credential, and FR-3 makes verification
 *    the only path that turns address control into an active account — a reset link that
 *    activated by side effect would be a second verification flow wearing the first one's name.
 *    The unverified holder's exit is S-02's resend (OQ-55), and the catalogue's reset-request
 *    wording points there without conceding whether this address holds anything.
 *  - **An active account**: outstanding reset tokens are retired (one live challenge, the
 *    verification flow's rule), a 60-minute token is issued (§12.5.6), and the email commits
 *    through the outbox with the state change (P-8, OQ-54).
 *
 * A LOCKED credential must pass through here untouched: §12.5.6 names the consumed link as a
 * lockout release, so the locked state is precisely who this flow serves. The lock is cleared by
 * `ResetPassword`, never by the request.
 *
 * Single `run`, unlike sign-in's several: the only counter a refused request must keep is the
 * throttle row, and refused-by-throttle deliberately records nothing (see `auth-throttle.ts`),
 * so outcome-then-throw covers it without splitting the transaction.
 */
export class RequestPasswordReset {
  constructor(
    private readonly store: AccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = normaliseEmail(command.email);
    const now = this.now();

    const limited = await this.store.run(async (tx) => {
      // `admitAuthAttempt`, not the count-record-compare shape written out — the 27 Aug 2026 sweep
      // converted four such copies and missed these two, and task 141 found them by searching for
      // the shape before closing. `apps/api/CLAUDE.md`: *spend a window with `admitAuthAttempt`,
      // never by hand*. Both copies were correct, which is the property that rule says does not
      // survive — each is self-consistent, so no test can see the difference.
      if (!(await admitAuthAttempt(tx, { key: passwordResetThrottleKey(command.clientIp, email), now }))) return true;

      const account = await tx.findAccountByEmail(email);
      if (account === null || account.status !== ACCOUNT_STATUS.ACTIVE) return false;

      await tx.invalidateOutstandingPasswordResetTokens(account.id, now);
      await this.issueChallenge(tx, account.id, account.email, account.locale, now);
      return false;
    });

    if (limited) throw new AuthRateLimitedError();
  }

  private async issueChallenge(
    tx: AccountTransaction,
    accountId: string,
    email: string,
    locale: PasswordResetRequested['locale'],
    now: Date,
  ): Promise<void> {
    const token = issuePasswordResetToken(now);

    await tx.issuePasswordResetToken({
      accountId,
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
    });

    const payload: PasswordResetRequested = { accountId, email, locale, token: token.value };
    await tx.emit({
      eventType: PASSWORD_RESET_REQUESTED,
      payload: { ...payload },
      // The verification flow's natural key, for the same two-directional reason: a re-emitted
      // row after a dispatcher crash dedupes, a genuine reissue has a later expiry and sends.
      idempotencyKey: `${PASSWORD_RESET_REQUESTED}:${accountId}:${token.expiresAt.getTime()}`,
    });
  }
}
