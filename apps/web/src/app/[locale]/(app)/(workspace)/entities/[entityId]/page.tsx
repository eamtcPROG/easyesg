import { EntityRecordSection } from '@/features/entities/components/record/entity-record-section';
import { ENTITY_RECORD_MESSAGES } from '@/features/entities/components/shared/entity-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-13 — Entity record · OA · UC-52 … UC-55 · Record
 *
 * D-2: entity master data is OA-owned; disclosure content is RC-owned. B1 pre-populates from this
 * record (FR-27) but stays editable in-report — B1 is a disclosure, not master data.
 *
 * **The artboard's Size region is absent**, and it is the one omission worth stating on this screen
 * rather than only in the plan: employee count and balance-sheet total are B1 disclosure data
 * (UC-19), gathered per reporting period, and the artboard's own callout — *"Fifty or more
 * employees changes what the 2026 report asks"* — describes conditional applicability, which is
 * task 41's rule interpreter over a period that does not exist until task 31. Recording a headcount
 * here would make master data of something the standard asks per report.
 *
 * **A shell since task 137** (`shell-composes-only`): it pins the locale and renders the section, which reads, decides
 * the arm and draws (`features/entities/components/record/entity-record-section.tsx`). `loading.tsx` beside it is the
 * record's own **loading — initial**, where the entities index's used to stand in for it.
 *
 * The per-field **change history** the artboard draws is S-12, appended as task 84 while task 30.3
 * was looking for its owner.
 */
export const generateMetadata = localizedPageTitle(ENTITY_RECORD_MESSAGES);

export default async function EntityRecordPage({
  params,
}: {
  params: Promise<{ locale: string; entityId: string }>;
}) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <EntityRecordSection entityId={entityId} />;
}
