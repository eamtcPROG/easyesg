'use client';

import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { SignOut } from '../../../shared/components/sign-out';
import { ACCEPTANCE_MESSAGES } from '../shared/acceptance-messages';

/**
 * S-43's **error** state for the read itself (task 195) — the screen could not learn which documents the account owes.
 *
 * The api's problem is rendered as received where there is one. The way on is leaving, for `SignOut`'s reason: every
 * signed-in address would send a reader still owing an acceptance straight back here, and S-01 turns away one who
 * holds a session. `SetupUnavailable`'s shape, on S-36.
 */
export function AcceptanceUnavailable({ failure }: { readonly failure: ApiFailure }) {
  const t = useTranslations(ACCEPTANCE_MESSAGES);
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
