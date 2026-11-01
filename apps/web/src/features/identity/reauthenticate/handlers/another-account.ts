import 'server-only';
import { readSession } from '@/server/session/session';

/**
 * Whether this browser already holds a session for someone else (task 92) — the one case both
 * submissions refuse before asking the api anything.
 *
 * **It happens in the plainest way**: the dialogue is open in one tab, and in another someone signs in
 * to a different account. Signing the dialogue's account in would replace that session in place, with
 * nothing on the other tab saying so — UX-136's second clause — and the queue behind the dialogue would
 * then drain as the other person, which is the attribution hazard task 35.2 keys the queue by account to
 * prevent.
 *
 * **A held session for the same account is not refused, and that is deliberate.** A cookie can still be
 * present for a session the api has revoked — the pass-through relays the api's `401` without clearing
 * it — so trusting it would answer *resumed* to a reader whose next write is refused again, and the
 * dialogue would reopen forever. Signing the same account in again replaces a session with an equivalent
 * one, which nobody can observe.
 */
export async function holdsAnotherAccount(accountId: string): Promise<boolean> {
  const held = await readSession();
  return held !== null && held.account.id !== accountId;
}
