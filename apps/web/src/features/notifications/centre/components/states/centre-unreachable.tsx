import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *error — recoverable* (task 50.2.1): the list or the count did not answer. It says nothing is lost — a notice
 * waits in the centre until it is read (UX-62) — and that the remedy is a reload, since this tier has no answer of its
 * own to offer. **The body says so**, so the callout's action is `null` — `apps/web/CLAUDE.md`'s rule for a next step
 * already in the message.
 */
export async function CentreUnreachable() {
  const t = await getTranslations(`${CENTRE_MESSAGES}.error.unreachable`);
  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
