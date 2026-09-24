import { ReportEntry } from '@/features/wizard/components/entry/report-entry';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-07 entry — resolves to where work last happened, else the first incomplete module, and
 * redirects (UC-36 and UX-10). **A shell since task 137** (`shell-composes-only`): it pins the locale
 * and renders the section, which reads and redirects (`features/wizard/components/entry/report-entry.tsx`).
 */
type Props = { params: Promise<{ locale: string; reportId: string }> };

export default async function ReportEntryPage({ params }: Props) {
  const { reportId } = await params;
  const locale = await activateRequestLocale(params as unknown as LocaleParams);
  return <ReportEntry reportId={reportId} locale={locale} />;
}
