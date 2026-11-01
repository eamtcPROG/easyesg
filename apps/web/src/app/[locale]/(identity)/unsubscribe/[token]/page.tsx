import { UnsubscribeSection } from '@/features/identity/unsubscribe/components/section/unsubscribe-section';
import { UNSUBSCRIBE_MESSAGES } from '@/features/identity/unsubscribe/components/shared/unsubscribe-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-38 — Unsubscribe from an email · CA · UC-173, UC-168 · Focus (task 52.2.2; FR-169)
 *
 * The landing surface of the link at the foot of every optional-category email, reachable **signed out and signed in
 * alike** — `route-access.ts` names `unsubscribe` among the unauthenticated segments, since the reader of an email is
 * usually not signed in and one click is the requirement's word. **Nothing is switched on render**: the section's read
 * changes nothing, and the switch is an explicit press. A shell: it pins the locale and renders the section.
 */
type Props = {
  params: LocaleParams & Promise<{ token: string }>;
};

export const generateMetadata = localizedPageTitle(UNSUBSCRIBE_MESSAGES);

export default async function UnsubscribePage({ params }: Props) {
  await activateRequestLocale(params);
  const { token } = await params;
  return <UnsubscribeSection token={token} />;
}
