'use client';

import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';

/**
 * What a credential form says when scripting is off (task 153; §12.5.6's task-153 row, NFR-81, NFR-79) — the
 * explicit failure in place of a silent one: the page needs JavaScript, nothing typed was sent, and how to turn it on.
 *
 * **Inside `<noscript>`**, so a browser running the page's script never draws it, and one that is not draws it from
 * the server's HTML. Its submit beside it stays disabled (`CredentialSubmit`), which is why *nothing was sent* is true.
 * **In `src/shared/` for `CredentialSubmit`'s reason.**
 */
export function ScriptingRequired() {
  const t = useTranslations('forms.scriptingRequired');
  return (
    <noscript>
      <Callout intent={CALLOUT_INTENT.WARNING} title={t('title')} action={t('action')}>
        {t('body')}
      </Callout>
    </noscript>
  );
}
