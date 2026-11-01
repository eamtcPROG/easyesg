import { ContactSupport } from '@/features/public/help/contact/components/section/contact-support';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { readKnownReader } from '@/server/session/known-reader';

/**
 * S-34 — Write to support · VI, CA · UC-182 · Focus (§4.6)
 *
 * **A shell, with the one read the amendment puts here** (`architecture.md` §12.5.6's task-77 row (10)): what a
 * signed-in reader is not asked — their name, address and organization — is read beside the session and handed to the
 * screen, because nothing under `features/public` may read a session (§5.1b as amended). A visitor is handed `null`.
 */
export const generateMetadata = localizedPageTitle('help.contact');

export default async function ContactSupportPage({ params }: { params: LocaleParams }) {
  // The locale first: the membership read takes its language from it. The read is the one the band already made, `cache()`d.
  const locale = await activateRequestLocale(params);
  return <ContactSupport reader={await readKnownReader()} locale={locale} />;
}
