'use client';

import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { SignOut } from '../shared/sign-out';

/**
 * S-36's **error** state for the read itself (task 155) — the screen could not learn which step the
 * account owes.
 *
 * The API's problem is rendered as received where there is one: an account abandoned in setup past its
 * deadline is answered `authentication-required`, whose own detail says to sign in again. The way on
 * is leaving in every case, for `SignOut`'s reason — S-01 would send a reader still holding the
 * session straight back here.
 */
export function SetupUnavailable({ failure }: { readonly failure: ApiFailure }) {
  const t = useTranslations(SETUP_MESSAGES);
  const problem = failure.status === API_OUTCOME.Problem ? failure.problem : null;

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={problem?.title ?? t('unavailableTitle')}
      action={<SignOut label={t('signOutAgain')} />}
    >
      {problem?.detail ?? t('unavailableBody')}
    </Callout>
  );
}
