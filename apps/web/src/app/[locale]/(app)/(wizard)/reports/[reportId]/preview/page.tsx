import { ReportPreview } from '@/features/export/preview/components/section/report-preview';
import { PREVIEW_MESSAGES } from '@/features/export/preview/components/shared/preview-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-10 — Report preview · RC, OA · UC-41 · Document
 *
 * UX-45: faithful — same content, same order, same marked gaps as the export, because it is the export's rendering: the
 * api renders the document and this screen frames it (`architecture.md` §12.5.6's task-43 row, which closed OQ-38).
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the report and the query,
 * unawaited — the document's language (`?language=`) is the section's to read. **No `loading.tsx`**, for S-07's reason:
 * an unknown report is answered with `notFound()` from the section, which a route-level boundary would flush past; the
 * document's own assembly is the frame's pending state.
 */
type Props = {
  params: Promise<{ locale: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(PREVIEW_MESSAGES);

export default async function ReportPreviewPage({ params, searchParams }: Props) {
  const { reportId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <ReportPreview reportId={reportId} searchParams={searchParams} />;
}
