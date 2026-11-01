import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { todayIn } from '@/lib/legal-date';
import { EXPORTS_READ, readReportExports } from '@/server/data/report-exports';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { initialExportLanguage } from '../../tools/export-languages';
import { COMPLETED_EXPORTS_QUERY, exportsListQuery, readExportsView } from '../../tools/exports-view';
import { ExportsBar } from '../bar/exports-bar';
import { ExportDialogue } from '../dialogue/export-dialogue';
import { FiledMark } from '../filing/filed-mark';
import { FilingPanel } from '../filing/filing-panel';
import { ExportsFrame } from '../frame/exports-frame';
import { ExportHistory } from '../history/export-history';
import { SupersededNotice } from '../notices/superseded-notice';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import { ExportsRefused } from '../states/exports-refused';
import styles from '../styles/exports.module.css';

/**
 * S-11 — the export dialogue and its history (tasks 47.1 … 47.5; UC-42 … UC-44, UC-48; FR-41, FR-44, FR-49 … FR-53), on
 * the Panel and Index archetypes. **It reads once and picks the arm**: an unknown report is the 404 a stale link
 * deserves; a report of another organization, or none bound, the forbidden state; a read that failed, the unreachable
 * one; a view-only member, the refusal beside the bar (182/22); anyone else, the screen — the heading, UX-48's notice
 * where the pin is superseded, the dialogue, the filed mark or the panel that makes one, and the history the address
 * names.
 */
export async function ReportExports({
  reportId,
  searchParams,
}: {
  readonly reportId: string;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The words and the reader's language started before the address is read, which the reads wait on (`async-api-routes`).
  const words = getTranslations(EXPORTS_MESSAGES);
  const language = getLocale();
  const view = readExportsView(await searchParams);
  const [t, read, reader] = await Promise.all([
    words,
    readReportExports({ reportId, history: exportsListQuery(view), completed: COMPLETED_EXPORTS_QUERY }),
    language,
  ]);

  if (read.status === TENANT_READ.NOT_FOUND) notFound();
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
  if (read.status === EXPORTS_READ.REFUSED) {
    return (
      <ExportsFrame bar={<ExportsBar report={read.report} />}>
        <ExportsRefused reportId={reportId} />
      </ExportsFrame>
    );
  }

  const { report } = read;
  return (
    <ExportsFrame bar={<ExportsBar report={report} />}>
      <header className={styles.heading}>
        <h1 className={`t-heading-2 ${styles.title}`}>{t('heading')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </header>
      {report.supersededBy === null ? null : <SupersededNotice report={report} supersededBy={report.supersededBy} />}
      <ExportDialogue
        reportId={reportId}
        entityId={report.subject.reportingEntityId}
        languages={read.languages}
        initialLanguage={initialExportLanguage({ exportLocale: read.exportLocale, reader })}
      />
      {report.filing === null ? (
        <FilingPanel
          reportId={reportId}
          exported={read.exported}
          validation={report.validation}
          // Today where the period's dates are decided, which is the zone a filing date is read in (NFR-34).
          today={todayIn(report.subject.periodStart.timezone, new Date())}
        />
      ) : (
        <FiledMark reportId={reportId} filing={report.filing} />
      )}
      <ExportHistory reportId={reportId} page={read.history} view={view} />
    </ExportsFrame>
  );
}
