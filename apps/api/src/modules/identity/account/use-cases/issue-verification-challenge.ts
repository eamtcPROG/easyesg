import {
  EMAIL_VERIFICATION_REQUESTED,
  type EmailVerificationRequested,
} from '../constants/account.constants';
import { issueVerificationToken } from '../domain/verification-token';
import type { AccountTransaction } from '../interfaces/account-store.interface';
import type { Account } from '../models/account.model';

/**
 * Mints a verification token and commits the intent to email it, on the caller's transaction.
 *
 * Shared by `RegisterAccount` and `ResendVerificationEmail` because both do exactly this and the
 * two must not diverge — a reissued challenge that carried a different lifetime, a different job
 * name or a different idempotency scheme from the original would be a second verification flow
 * wearing the first one's name.
 *
 * It takes the transaction rather than the store, which is what keeps P-8 true: the token row and
 * the outbox row commit with whatever the caller is already doing — creating an account, or
 * retiring the previous challenge — or neither does.
 */
export async function issueVerificationChallenge(
  tx: AccountTransaction,
  account: Account,
  now: Date,
): Promise<void> {
  const token = issueVerificationToken(now);

  await tx.issueVerificationToken({
    accountId: account.id,
    tokenHash: token.hash,
    expiresAt: token.expiresAt,
  });

  const payload: EmailVerificationRequested = {
    accountId: account.id,
    email: account.email,
    locale: account.locale,
    // The raw value, which exists nowhere else once this returns — the table holds its SHA-256.
    // OQ-54 records the decision and what bounds the exposure.
    token: token.value,
  };

  await tx.emit({
    eventType: EMAIL_VERIFICATION_REQUESTED,
    payload: { ...payload },
    // A natural key, as AD-6 asks: one account, one issuance instant. A re-emitted row after a
    // dispatcher crash carries the same key and is discarded by the queue rather than sending a
    // second email — while a genuine reissue (OQ-55) has a later expiry and is therefore a
    // different key, which is the behaviour that matters in both directions.
    idempotencyKey: `${EMAIL_VERIFICATION_REQUESTED}:${account.id}:${token.expiresAt.getTime()}`,
  });
}
