import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { UNSUBSCRIBE_MESSAGES } from '../shared/unsubscribe-messages';

/**
 * S-38's *the link can switch nothing off* (task 52.2.2) — not issued by the platform, or its category may no longer
 * be switched off. One sentence for both, as the api gives one standing: the way out is the same, the link in the
 * latest such email, and telling a holder which it was would describe the signature check to whoever is probing it.
 */
export async function Unusable() {
  const t = await getTranslations(UNSUBSCRIBE_MESSAGES);

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('unusableTitle')} action={null}>
      {t('unusableBody')}
    </Callout>
  );
}
