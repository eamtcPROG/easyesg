'use client';

import { Button, Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { continueAfterSetupAction } from '../../actions/actions';
import { SETUP_MESSAGES } from '../shared/setup-messages';

/**
 * S-36's **success** state (task 155) — the account is active, and the next destination is offered
 * rather than taken.
 *
 * It renders when setup finished somewhere this screen did not see — another tab, another device — so
 * the session's sealed cookie may still say *in setup*. Continuing is an action for that reason: it
 * renews the session before §4.3's branch, and a plain link would be turned straight back here by the
 * proxy until the cookie's next rotation.
 */
export function SetupComplete({ returnTo }: { readonly returnTo?: string }) {
  const t = useTranslations(SETUP_MESSAGES);
  const [pending, startTransition] = useTransition();

  return (
    <Callout
      intent={CALLOUT_INTENT.SUCCESS}
      title={t('completeTitle')}
      action={
        <Button
          busy={pending}
          onClick={() =>
            startTransition(async () => {
              await continueAfterSetupAction({ returnTo });
            })
          }
        >
          {t('continue')}
        </Button>
      }
    >
      {t('completeBody')}
    </Callout>
  );
}
