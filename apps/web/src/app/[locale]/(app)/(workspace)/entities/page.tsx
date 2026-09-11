import { EntitiesSection } from '@/features/entities/components/list/entities-section';
import { ENTITIES_MESSAGES } from '@/features/entities/components/shared/entity-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-13 — Entities index · OA · UC-52 … UC-55 · Index
 *
 * The legal entities that are reported on (FR-17 … FR-20). **Four of the artboard's six columns
 * belong to other tasks and are refused rather than invented**: entity IDNO and its *verified*
 * marker are FR-107's fiscal lookup on the billing account, employee count is B1 disclosure data
 * (UC-19) rather than entity master data, the periods column is task 31's, and the entitlement
 * counter above the action is task 54.2's — the same deferral S-16 recorded for seats.
 *
 * **The screen never computes the caller's role**, which is S-15's and S-16's rule: the writes are
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` and the reads are open to every member, so this
 * renders what it is given and the record's own refusal names the boundary.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. The two empty states are `EntitiesList`'s, because §4.6 requires them to teach and
 * teaching means naming this object. *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section, which reads, decides the arm and draws. `loading.tsx` beside it is the screen's
 * `loading — initial`, on S-16's precedent — the whole body waits on the read, so there is no
 * shell worth streaming ahead of it.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(ENTITIES_MESSAGES);

export default async function EntitiesIndexPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  return <EntitiesSection searchParams={searchParams} />;
}
