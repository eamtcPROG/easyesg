import { CALLOUT_INTENT, Callout, DocumentFrame, DocumentPages, DocumentShell } from '@easyesg/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { moduleName } from '@/features/wizard/tools/module-words';
import { PREVIEW_LANGUAGE_PARAM } from '@/lib/routes';
import { PREVIEW_READ, readReportPreview } from '@/server/data/report-preview';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { PREVIEW_FRAME, documentAddress, documentPages, previewLanguage } from '../../tools/preview';
import { PreviewBar } from '../bar/preview-bar';
import { PreviewHeading } from '../heading/preview-heading';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';
import { PreviewRefused } from '../states/preview-refused';

/**
 * S-10 — the report as its document (task 43.2; UC-41, FR-48), on the Document archetype. **It reads the frame around
 * the document and never the document**: the frame loads the api's rendering through the session pass-through, in the
 * language the address names or the account's export default (182/34), and the page list opens each of the document's
 * pages in it (`architecture.md` §12.5.6's task-43 row).
 *
 * Its arms: an unknown report is the 404 a stale link deserves; a report of another organization, or none bound, is
 * the forbidden state; a read that failed, the unreachable one; a view-only member, the refusal beside the bar (182/22);
 * anyone else, the document.
 */
export async function ReportPreview({
  reportId,
  searchParams,
}: {
  readonly reportId: string;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, tWizard, read, reader, query] = await Promise.all([
    getTranslations(PREVIEW_MESSAGES),
    getTranslations(WIZARD_MESSAGES),
    readReportPreview(reportId),
    getLocale(),
    searchParams,
  ]);

  if (read.status === PREVIEW_READ.REPORT_NOT_FOUND) notFound();
  if (read.status === TENANT_READ.FORBIDDEN) {
    await redirectToChoiceIfOwed();
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('forbidden.title')} action={null}>
        {t('forbidden.body')}
      </Callout>
    );
  }
  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={null}>
        {t('unreachable.body')}
      </Callout>
    );
  }

  const language = previewLanguage({
    asked: query[PREVIEW_LANGUAGE_PARAM],
    exportDefault: read.exportLocale,
    reader,
  });
  const document = documentAddress({ reportId, locale: language });

  return (
    <DocumentShell
      bar={<PreviewBar report={read.report} />}
      heading={<PreviewHeading reportId={reportId} language={read.mayPreview ? language : null} />}
      pages={
        read.mayPreview ? (
          <DocumentPages
            label={t('pages')}
            document={document}
            frame={PREVIEW_FRAME}
            pages={documentPages({
              modules: read.modules,
              scope: read.report.scope,
              pageName: (page) => t(`pageNames.${page}`),
              // The bare name: the list shows the module's reference beside it.
              moduleName: (module) => moduleName(tWizard, module) ?? module,
            })}
          />
        ) : undefined
      }
    >
      {read.mayPreview ? (
        // Keyed by the language, so a choice of another one is a fresh frame with its own pending state.
        <DocumentFrame key={language} src={document} name={PREVIEW_FRAME} title={t('frame')} pending={t('pending')} />
      ) : (
        <PreviewRefused reportId={reportId} />
      )}
    </DocumentShell>
  );
}
