'use server';

import type {
  AccountSetup,
  SaveSetupProfileRequest,
  SessionResponse,
  SetFirstPasswordByGrantRequest,
  SetFirstPasswordRequest,
} from '@easyesg/contracts';
import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { completeAccountRoute } from '@/lib/routes';
import { api } from '@/server/api/api-client';
import { consumeSetupGrant, holdSetupGrant } from '@/server/sealed/setup-grant';
import { resolvePostSignIn } from '@/server/session/post-sign-in';
import {
  establishSession,
  readSession,
  rememberLocale,
  renewSession,
} from '@/server/session/session';
import { targetLocale } from '../../shared/tools/post-sign-in';
import { grantSurvivesRefusal } from '../tools/grant-put-back';
import { SETUP_GRANT_LAPSED } from '../tools/password-step';
import type { PasswordStepFailure, ProfileStepFailure } from './action-results';

/**
 * S-36's writes (task 155; §12.5.6's task-155 row, `design_spec.md` S-36). The transport rule is
 * stated once, in `shared/actions/actions.ts`.
 *
 * **Every success ends in a redirect, and that is the whole of how the screen moves.** A step that
 * leaves setup owed redirects to S-36's own address, whose section re-reads what the account holds
 * and draws the step actually next; one that completes setup renews the session — so its cookie says
 * `active` before the proxy next reads it — and takes §4.3's branch with the deep link it carried.
 */

/**
 * Leaves setup. The rotation comes first because the proxy sends an account its cookie calls
 * *in setup* back to S-36 from every address that needs a session, and a branch taken with the stale
 * cookie would be turned straight round. The branch then reads memberships with the renewed token.
 */
async function continueFromSetup(returnTo: string | undefined): Promise<void> {
  const current = await readSession();
  const renewed = current ? await renewSession(current) : null;
  const locale =
    renewed && 'session' in renewed ? renewed.session.account.locale : (current?.account.locale ?? (await getLocale()));

  const target = await resolvePostSignIn(returnTo);
  redirect({ href: target.href, locale: targetLocale(target, locale) });
}

/** S-36's first step, on the proof of the session's own provider sign-in. */
export async function setFirstPasswordAction(command: {
  readonly password: string;
  readonly returnTo?: string;
}): Promise<PasswordStepFailure> {
  const outcome = await api.post<SetFirstPasswordRequest, AccountSetup>('/account/setup/password', {
    password: command.password,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  if (outcome.value.status === ACCOUNT_STATUS.ACTIVE) {
    await continueFromSetup(command.returnTo);
    return undefined;
  }
  // The name is still owed. The reader's current language, not the account's: they are mid-setup.
  redirect({ href: completeAccountRoute(command.returnTo), locale: await getLocale() });
}

/**
 * S-36's first step on S-02's path, on the proof of the confirmation's grant — which signs the person
 * in once the password is set, for as long as they asked on the step (§12.5.6's task-155 row (4)).
 */
export async function setFirstPasswordByGrantAction(command: {
  readonly password: string;
  readonly remember: boolean;
}): Promise<PasswordStepFailure> {
  const held = await consumeSetupGrant();
  if (!held) return { status: SETUP_GRANT_LAPSED };

  const outcome = await api.post<SetFirstPasswordByGrantRequest, SessionResponse>(
    '/auth/account-setup/password',
    { grant: held.grant, password: command.password, remember: command.remember },
  );
  if (outcome.status !== API_OUTCOME.Ok) {
    if (grantSurvivesRefusal(outcome)) await holdSetupGrant(held);
    return outcome;
  }

  const session = await establishSession({ session: outcome.value, remembered: command.remember });
  if (session.account.status === ACCOUNT_STATUS.ACTIVE) {
    const target = await resolvePostSignIn(held.returnTo);
    redirect({ href: target.href, locale: targetLocale(target, session.account.locale) });
    return undefined;
  }
  redirect({ href: completeAccountRoute(held.returnTo), locale: await getLocale() });
}

/** S-36's second step — both name parts and the interface language. */
export async function saveSetupProfileAction(
  command: SaveSetupProfileRequest & { readonly returnTo?: string },
): Promise<ProfileStepFailure> {
  const outcome = await api.post<SaveSetupProfileRequest, AccountSetup>('/account/setup/profile', {
    givenName: command.givenName,
    familyName: command.familyName,
    locale: command.locale,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  // OQ-32: the language the person has just chosen is the one the app answers in from here.
  await rememberLocale(outcome.value.locale);

  if (outcome.value.status === ACCOUNT_STATUS.ACTIVE) {
    await continueFromSetup(command.returnTo);
    return undefined;
  }
  // The password is still owed — only reachable when this step was submitted from a stale screen.
  redirect({ href: completeAccountRoute(command.returnTo), locale: outcome.value.locale });
}

/**
 * S-36's complete state: the account finished its setup — in another tab, or on another device — and
 * this session's cookie has not heard yet. Renewing it here is what stops the proxy turning the next
 * address straight back to S-36.
 */
export async function continueAfterSetupAction(command: {
  readonly returnTo?: string;
}): Promise<void> {
  await continueFromSetup(command.returnTo);
}
