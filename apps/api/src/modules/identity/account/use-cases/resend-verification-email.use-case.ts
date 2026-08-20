import { unverifiedAccountHasExpired } from '../domain/account-expiry';
import { normaliseEmail } from '../domain/email-address';
import type { AccountStore } from '../interfaces/account-store.interface';
import { ACCOUNT_STATUS } from '../models/account.model';
import { issueVerificationChallenge } from './issue-verification-challenge';

/**
 * Reissue a verification link (FR-3; OQ-55, closed 20 Aug 2026).
 *
 * **Why this exists at all.** The link lives 24 hours (§12.5.6) and the unverified account lives
 * seven days (OQ-52), so for six of those days the account exists, cannot be verified, cannot be
 * signed in to, and cannot be re-registered — `register` answers `409` (OQ-53). FR-3 requires a
 * time-limited link, and a time-limited link with no way to obtain another is not a satisfiable
 * requirement. This is that way.
 *
 * **It returns nothing, and every path through it returns the same nothing.** Unknown address,
 * already-verified account, expired account, reissued challenge — all four are indistinguishable
 * to the caller, which is NFR-64's uniform-response requirement and the shape FR-6's reset request
 * uses. Unlike registration, nothing here needs to tell the caller anything, so there is no reason
 * to make it an enumeration oracle. The one asymmetry left is timing, and it is small: the branch
 * that sends does two more writes, not a password hash.
 *
 * Note what it deliberately does **not** do: it never creates an account, never changes a password
 * and never revives an expired one. An unauthenticated caller naming someone else's address can
 * cause one email to be sent to that address and nothing else — which is the same exposure FR-6's
 * reset request already carries, bounded by the edge rate limit (§12.5.6).
 */
export class ResendVerificationEmail {
  constructor(
    private readonly store: AccountStore,
    private readonly now: () => Date,
  ) {}

  async execute(rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);

    await this.store.run(async (tx) => {
      const now = this.now();

      const account = await tx.findAccountByEmail(email);
      if (!account) return;
      if (account.status !== ACCOUNT_STATUS.UNVERIFIED) return;
      // Past its window it is not a live account, and reissuing would extend by the back door a
      // deadline OQ-52 set. Registration reclaims the record when the address is next used.
      if (unverifiedAccountHasExpired(account, now)) return;

      // Retire the outstanding challenge first, so a reissue leaves exactly one live link rather
      // than one per request — otherwise every resend widens the window in which some older link,
      // sitting in some older mailbox, still works.
      await tx.invalidateOutstandingVerificationTokens(account.id, now);
      await issueVerificationChallenge(tx, account, now);
    });
  }
}
