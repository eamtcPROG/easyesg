import { ACCOUNT_STATUS, type Account } from '../models/account.model';

/**
 * FR-3's "defined window" for an unverified account (OQ-52, closed 20 Aug 2026).
 *
 * **Seven days, and expiry deletes the record.** The reasoning is in the register row; what
 * belongs here is why this is a *predicate* rather than a scheduled job.
 *
 * The requirement is that an unverified account stops being an account after the window — that it
 * cannot be verified, and that it stops holding its address against the person who registered it.
 * Both are answerable at the moment they are asked, from `created_at`, with no job having run. A
 * sweep is what reclaims the rows afterwards, and a sweep is data hygiene: if it is late, or has
 * never run at all, nothing above is untrue. Building the predicate first therefore makes the
 * requirement hold from this task rather than from Phase 6's scheduler — and it removes the
 * failure where the sweep is down and expiry silently stops being enforced.
 *
 * The reclaiming sweep still lands with the scheduler (AD-10 lists "trial and invitation expiry"
 * as queue work) and is recorded as such, so this is a split rather than a substitution.
 */
export const UNVERIFIED_ACCOUNT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function unverifiedAccountHasExpired(account: Account, now: Date): boolean {
  if (account.status !== ACCOUNT_STATUS.UNVERIFIED) return false;
  return now.getTime() - account.createdAt.getTime() >= UNVERIFIED_ACCOUNT_TTL_MS;
}
