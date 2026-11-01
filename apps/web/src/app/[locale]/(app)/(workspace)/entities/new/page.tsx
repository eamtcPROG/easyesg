import { NewEntitySection } from '@/features/entities/components/record/new-entity-section';
import { ENTITY_RECORD_MESSAGES } from '@/features/entities/components/shared/entity-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-13's Record in its **create** mode (UC-52) — `/entities/new`.
 *
 * A literal segment rather than a query flag on the record route, so an unsaved new entity is an
 * address the reader can return to and link (UX-4), and so the `[entityId]` route never has to
 * decide whether `new` is an id.
 *
 * **A shell since task 137** (`shell-composes-only`): the section reads the organization's country and the legal forms
 * it scopes (`features/entities/components/record/new-entity-section.tsx`), and `loading.tsx` beside it waits for it.
 */
export const generateMetadata = localizedPageTitle(ENTITY_RECORD_MESSAGES);

export default async function NewEntityPage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);
  return <NewEntitySection />;
}
