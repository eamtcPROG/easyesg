import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';

/**
 * No factor set serves the report's period (FR-35; the writes refuse with `no_factor_set`). **Above the lines, not
 * instead of them**: what was entered is the permanent record UX-41 keeps on screen, so the board still shows it,
 * read-only, and this says why nothing can be added. The detail's last sentence is the "what now" — there is nothing
 * the reader can do but wait, and it says so rather than offering an action that would fail.
 */
export async function NoFactorSet() {
  const t = await getTranslations(CALCULATOR_MESSAGES);
  return (
    <Callout intent={CALLOUT_INTENT.WARNING} title={t('noFactorSet.title')} action={null}>
      {t('noFactorSet.body')}
    </Callout>
  );
}
