import { PeriodsSection } from '@/features/periods/components/periods-section';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-14 — Reporting periods · OA · UC-56 … UC-58 · Index
 *
 * The years an entity files against (FR-21, FR-22, FR-45, FR-66). **The heading names the entity**,
 * because a period only means anything against one and an organization reporting on three has three
 * of these lists — a heading reading only "Reporting periods" would make them indistinguishable in
 * a bookmark or a screenshot.
 *
 * **The screen never computes the caller's role**, which is S-13's and S-15's rule: the writes are
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` and the reads are open to every member, so this
 * renders what it is given and the record's own refusal names the boundary.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. The two empty states are `PeriodsList`'s, because §4.6 requires them to teach. *
 * **This file is a shell** (task 134, `shell-composes-only`): it pins the locale and renders the
 * section, which reads, decides the arm and draws. `loading.tsx` beside it is the screen's
 * `loading — initial`, on S-16's precedent — the whole body waits on the read, so there is no
 * shell worth streaming ahead of it.
 */
type Props = {
  params: Promise<{ locale: string; entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(PERIODS_MESSAGES);

export default async function ReportingPeriodsPage({ params, searchParams }: Props) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <PeriodsSection entityId={entityId} searchParams={searchParams} />;
}
