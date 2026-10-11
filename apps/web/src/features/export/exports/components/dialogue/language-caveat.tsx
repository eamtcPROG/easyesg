import type { Locale } from '@easyesg/i18n';
import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';

/**
 * UX-47's statement (task 47.3; T-14 as amended): the labels in the chosen language are the platform's, with no EFRAG
 * standing — and the language whose labels are EFRAG's own, recommended for a bank or an EU buyer, named as the choice
 * above names it. Drawn only beside a language the api calls platform-authored at the report's pin.
 *
 * No directive: drawn inside the dialogue, a client boundary already, and it reads its own words.
 */
export function LanguageCaveat({ recommended }: { readonly recommended: Locale | null }) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tLocales = useTranslations('chrome.locales');
  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('dialogue.caveat.title')} action={null}>
      {t('dialogue.caveat.body')}
      {recommended === null ? null : ` ${t('dialogue.caveat.recommend', { language: tLocales(recommended) })}`}
    </Callout>
  );
}
