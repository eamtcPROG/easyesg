'use client';

import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { REMIND_MESSAGES } from '../shared/remind-messages';

/**
 * The reminder panel whose two reads — the members, the reports — did not both answer (task 50.3).
 *
 * **Partial, not the screen's error**: the list above resolved and is true, and only what this panel would offer is
 * unknown — so it says so here, the invite panel's *invitations paused* reasoning. **Attention rather than error**,
 * for the same reason that one gives: nothing the reader did caused it, and an alert on every load would be noise.
 *
 * **Its action retries** (§8.1's partial: *retry for that part*): the two reads are the section's, on the server, so
 * asking again is re-rendering the route rather than a request this component could make itself.
 */
export function RemindersUnavailable() {
  const t = useTranslations(`${REMIND_MESSAGES}.unavailable`);
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <Callout
      intent={CALLOUT_INTENT.ATTENTION}
      title={t('title')}
      action={
        <Button variant={BUTTON_VARIANT.SECONDARY} busy={retrying} onClick={() => startRetry(() => router.refresh())}>
          {t('retry')}
        </Button>
      }
    >
      {t('body')}
    </Callout>
  );
}
