'use client';

import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ACCESS_MESSAGES } from './access-messages';

/**
 * S-16's seat count unavailable, where the invitation form would be (task 142).
 *
 * **Partial, not error** (§8.1): the list above resolved and is true, and everything it offers still
 * works. What cannot be done is the one write the API refuses while the ceiling is unreadable — it
 * fails closed (`architecture.md` §12.5.6) — so the form is not offered, and this says why and what
 * to do rather than letting the reader find out by submitting.
 *
 * **Attention rather than warning**: nothing the reader did caused it and nothing they fix resolves
 * it, which is the attention intent's case; a warning would announce as an alert on every load.
 */
export function InvitationsPaused() {
  const t = useTranslations(`${ACCESS_MESSAGES}.seats.paused`);

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={t('action')}>
      {t('body')}
    </Callout>
  );
}
