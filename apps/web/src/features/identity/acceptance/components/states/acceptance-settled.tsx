'use client';

import { Button, Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { continueAfterAcceptanceAction } from '../../actions/actions';
import { ACCEPTANCE_MESSAGES } from '../shared/acceptance-messages';

/**
 * S-43's **success** state (task 195) — nothing is owed, and the next destination is offered rather than taken.
 *
 * It renders when the acceptance landed somewhere this page did not see — another tab, a press that arrived — or when
 * the address was opened with nothing owed. Continuing is an action, for `SetupComplete`'s reason on S-36: it asks
 * §4.3's branch on the server, with `?return=` honoured, where a plain link would have to guess the destination.
 */
export function AcceptanceSettled({ returnTo }: { readonly returnTo?: string }) {
  const t = useTranslations(ACCEPTANCE_MESSAGES);
  const [pending, startTransition] = useTransition();

  return (
    <Callout
      intent={CALLOUT_INTENT.SUCCESS}
      title={t('settledTitle')}
      action={
        <Button
          busy={pending}
          onClick={() =>
            startTransition(async () => {
              await continueAfterAcceptanceAction({ returnTo });
            })
          }
        >
          {t('continue')}
        </Button>
      }
    >
      {t('settledBody')}
    </Callout>
  );
}
