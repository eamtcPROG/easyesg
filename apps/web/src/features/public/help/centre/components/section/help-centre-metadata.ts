import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';

/**
 * S-32's title in the browser's tab (task 77; WCAG 2.2 2.4.2) — the help centre's name, where the page's heading is the
 * question it asks the reader.
 */
export async function generateHelpCentreMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: HELP_CENTRE_MESSAGES });
  return { title: t('metaTitle') };
}
