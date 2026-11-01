'use server';

import type { AcceptLegalDocumentsRequest, LegalVersionsRequest } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { resolvePostSignIn } from '@/server/session/post-sign-in';
import { targetLocale } from '../../shared/tools/post-sign-in';

/**
 * Where S-43 sends a reader once nothing is owed (task 195): `?return=`, or §4.3's branch — asked again now, so the
 * memberships the api refused while an acceptance was owed are read. **The address's own locale**, by
 * `targetLocale`'s test: no session is issued here, and the reader is mid-journey in the language they chose.
 */
async function continueFromAcceptance(returnTo: string | undefined): Promise<never> {
  const [target, locale] = await Promise.all([resolvePostSignIn(returnTo), getLocale()]);
  return redirect({ href: target.href, locale: targetLocale(target, locale) });
}

/**
 * S-43's *Continue* once its checkbox is ticked (task 195; `design_spec.md` S-43): the versions the page displayed,
 * which the api records — or refuses as no longer in force, answered with its three parts and a reload as the way on.
 * A refusal or an unreachable api comes back to the form; a success never does, since it leaves.
 */
export async function acceptLegalDocumentsAction(command: {
  readonly legalVersions: LegalVersionsRequest;
  readonly returnTo?: string;
}): Promise<ApiFailure | undefined> {
  const outcome = await api.post<AcceptLegalDocumentsRequest, undefined>('/account/legal-acceptance', {
    legalVersions: command.legalVersions,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;
  return continueFromAcceptance(command.returnTo);
}

/** S-43's success state — nothing owed when the page was read, from another tab or a press that already landed. */
export async function continueAfterAcceptanceAction(command: { readonly returnTo?: string }): Promise<void> {
  await continueFromAcceptance(command.returnTo);
}
