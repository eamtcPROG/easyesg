'use server';

import type {
  CompleteFactorRequest,
  FactorChallengeResponse,
  SessionResponse,
  SignInRequest,
} from '@easyesg/contracts';
import { SIGN_IN_OUTCOME } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { ROUTES } from '@/lib/routes';
import { redirect } from '@/i18n/navigation';
import { api } from '@/server/api/api-client';
import { consumeFactorChallenge, holdFactorChallenge } from '@/server/sealed/factor-challenge';
import { resolvePostSignIn } from '@/server/session/post-sign-in';
import { establishSession } from '@/server/session/session';
import { targetLocale } from '../../shared/tools/post-sign-in';
import { FACTOR_LAPSED, type CompleteFactorFailure } from '../tools/factor';
import type { SignInFailure } from './action-results';

/** S-01 sign-in and its factor step (FR-4, UC-04, UC-194, UC-195). The transport rule is stated once, in `shared/actions/actions.ts`. */
/**
 * UC-194's second step, and UC-195's recovery-code route through the same field.
 *
 * The challenge itself never reaches the browser: it is read from the sealed cookie the first step
 * wrote, which is what keeps a value proving "this password was just verified" out of a form.
 */
export async function completeFactorAction(command: {
  code: string;
}): Promise<CompleteFactorFailure> {
  const held = await consumeFactorChallenge();
  // Lapsed, never issued, or cleared: the challenge proves the password was verified *just now*,
  // so nothing here revives it and the only way on is S-01. Reported as its own standing rather
  // than as `unreachable` — nothing failed to reach the API, and "try again" would be the wrong
  // sentence for a step that cannot be tried again (`factor.ts`).
  if (!held) return { status: FACTOR_LAPSED };

  const outcome = await api.post<CompleteFactorRequest, SessionResponse>(
    '/auth/session/factor',
    { challenge: held.challenge, code: command.code },
  );
  if (outcome.status !== API_OUTCOME.Ok) {
    // **The challenge is put back on a refusal.** §12.5.6 makes it deliberately not single-use so
    // a mistyped code leaves the reader on the step rather than back at their password; consuming
    // it here would take that away.
    await holdFactorChallenge(held);
    return outcome;
  }

  // The answer given at the password step. The API applied its own sealed copy to the session's
  // lifetime; this applies ours to the cookie's persistence.
  const session = await establishSession({ session: outcome.value, remembered: held.remember });
  const target = await resolvePostSignIn(held.returnTo ?? undefined);
  redirect({ href: target.href, locale: targetLocale(target, session.account.locale) });
}

export interface SignInCommand {
  email: string;
  password: string;
  /**
   * S-01's *Keep me signed in on this device*. It reaches the API, which decides the session's
   * lifetime from it (§12.5.6, OQ-35 amended 4 Sep 2026), and the cookie, which is persistent only
   * when it is true — the API's cap is the authority and the cookie is what a shared machine
   * actually experiences.
   */
  remember: boolean;
  /**
   * `proxy.ts`'s `?return=` value, carried through the screen — and **sanitized downstream**, in
   * `resolvePostSignIn`, because it round-trips through the browser and is therefore
   * attacker-shapeable.
   *
   * Sanitizing there rather than here is deliberate: `postSignInTarget` decides whether a deep link
   * is honoured at all, and a path it must not honour and a path that is not a path are one
   * question with one answer. Task 27.8 carries this value across the factor step in the sealed
   * challenge cookie, and that path lands in the same function.
   */
  returnTo?: string;
}

/**
 * S-01 sign-in (FR-4, UC-04) — the only action that ends in a redirect rather than a result,
 * because success ends the SCREEN: the session cookie is set, the locale cookie follows the
 * profile preference (OQ-32), and the user lands where they were headed. Only failures return
 * — the type says so (`SignInFailure`, not an outcome), and the client sees `undefined` when
 * the redirect won.
 *
 * A `?return=` path keeps its own locale (OQ-32: the URL is authoritative for rendering — a
 * session that expired on `/en/reports` resumes in English whatever the profile says); the
 * profile preference decides only when there was nowhere to return to — which, since task 25.4,
 * includes every case where the branch overrode the return path.
 */
export async function signInAction(command: SignInCommand): Promise<SignInFailure> {
  const outcome = await api.post<SignInRequest, SessionResponse | FactorChallengeResponse>(
    '/auth/session',
    { email: command.email, password: command.password, remember: command.remember },
  );
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  // **Two shapes since task 27.3**, discriminated by `kind` and never by probing for a field. An
  // account with a second factor gets a challenge instead of a session (UC-194) — held server-side
  // in its own sealed cookie, exactly as task 24's OAuth transaction is, because it proves this
  // API verified the password just now and must not be readable by the browser.
  const answered = outcome.value;
  if (answered.kind !== SIGN_IN_OUTCOME.SIGNED_IN) {
    await holdFactorChallenge({
      challenge: answered.challenge,
      expiresAt: answered.expiresAt,
      returnTo: command.returnTo,
      remember: command.remember,
    });
    // The reader's CURRENT locale, not the profile's: they are still on S-01 and the sign-in has
    // not completed, so OQ-32's preference has nothing to apply to yet.
    redirect({ href: ROUTES.SIGN_IN_FACTOR, locale: await getLocale() });
    // `redirect` throws, so this is unreachable — it is here because next-intl's does not declare
    // `never`, and without it the union below is not narrowed.
    return undefined;
  }

  const session = await establishSession({ session: answered, remembered: command.remember });
  // §4.3's branch, over the memberships the session can now read (task 25.4). It replaces the
  // recorded interim that landed every sign-in on `/home`, and it decides the `?return=` question
  // too: a deep link is honoured only where an organization resolves.
  const target = await resolvePostSignIn(command.returnTo);
  // An unprefixed return path IS the source locale's form (`localePrefix: 'as-needed'`); a
  // branch destination has no locale of its own, so the profile preference decides (OQ-32).
  redirect({ href: target.href, locale: targetLocale(target, session.account.locale) });
}
