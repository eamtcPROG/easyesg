import { ReportExports } from '@/features/export/exports/components/section/report-exports';
import { EXPORTS_MESSAGES } from '@/features/export/exports/components/shared/exports-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-11 — Export dialogue and history · RC, OA · UC-42 … UC-44, UC-48 · Panel + Index
 *
 * UX-47: exactly two decisions — format and language, the language chosen apart from the interface's (FR-52), with the
 * statement beside a language whose labels carry no EFRAG standing. UX-46: a job from the first interaction — the
 * request acknowledged at once, a named place to watch, freedom to leave; past 30 s the person who asked is told by a
 * notice. UX-25: export is permitted with unresolved findings after an explicit warning listing them (FR-44).
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the report and the query,
 * unawaited — the history's view is the section's to read. **No `loading.tsx`**, for S-10's reason: an unknown report is
 * answered with `notFound()` from the section, which a route-level boundary would flush past.
 */
type Props = {
  params: Promise<{ locale: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(EXPORTS_MESSAGES);

export default async function ReportExportsPage({ params, searchParams }: Props) {
  const { reportId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <ReportExports reportId={reportId} searchParams={searchParams} />;
}
