import type { Locale } from '@easyesg/i18n';
import { FocusColumn, PageHeading } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '../form/contact-form';
import type { KnownReader } from '../../tools/known-reader';
import { CONTACT_MESSAGES } from '../shared/contact-messages';

/**
 * S-34 — write to support (task 77.4; UC-182, FR-212; `design_spec.md` S-34, Focus archetype): one column, one primary
 * action. **It reads nothing**: the reader the route resolved, or `null`, is all it needs, and the form does the one
 * write.
 */
export async function ContactSupport({ reader, locale }: { readonly reader: KnownReader | null; readonly locale: Locale }) {
  const t = await getTranslations(CONTACT_MESSAGES);
  return (
    <FocusColumn>
      <PageHeading title={t('title')} summary={t('lede')} />
      <ContactForm reader={reader} locale={locale} />
    </FocusColumn>
  );
}
