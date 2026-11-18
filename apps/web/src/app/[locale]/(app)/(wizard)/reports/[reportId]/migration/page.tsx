import { MIGRATION_MESSAGES } from '@/features/report-migration/components/migration-messages';
import { MigrationSection } from '@/features/report-migration/components/migration-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-49 — Review a migrated report · OA · UC-78, UC-79 · Focus inside the report
 *
 * 182/43: for a breaking taxonomy change the Organization Administrator reviews and accepts or declines their own
 * migrated report; declining restores the state the run kept (182/41). Reached from the notice the run raises, and from
 * S-06's row for a report that awaits the decision.
 *
 * **This file is a shell** (`shell-composes-only`). **No `loading.tsx`**, S-11's reason: an unknown report is answered
 * with `notFound()` from the section, which a route-level boundary would flush past.
 */
type Props = { params: Promise<{ locale: string; reportId: string }> };

export const generateMetadata = localizedPageTitle(MIGRATION_MESSAGES);

export default async function ReportMigrationPage({ params }: Props) {
  const { reportId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <MigrationSection reportId={reportId} />;
}
