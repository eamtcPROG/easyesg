import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { UNSUBSCRIBE_MESSAGES } from '../shared/unsubscribe-messages';

/**
 * S-38's *already switched off* (task 52.2.2): from this link before, or from the profile. A success rather than an
 * error — the reader wanted these emails stopped, and they are — so there is nothing to press and no way out to name.
 */
export async function SwitchedOff({ categoryName }: { categoryName: string | null }) {
  const t = await getTranslations(UNSUBSCRIBE_MESSAGES);

  return (
    <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('alreadyTitle')} action={null}>
      {categoryName === null ? t('alreadyBodyUnnamed') : t('alreadyBody', { category: categoryName })}
    </Callout>
  );
}
