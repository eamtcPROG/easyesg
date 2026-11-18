import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ROUTES, reportRoute } from '@/lib/routes';
import { MIGRATION_READ, readReportMigration } from '@/server/data/report-migration';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { MigrationBar } from './migration-bar';
import { MigrationFrame } from './migration-frame';
import { MigrationReview } from './migration-review';
import { MIGRATION_MESSAGES } from './migration-messages';

/**
 * S-49's one region (task 67.20): the read, and which of §8.1's arms applies. **The section reads; the parts render** —
 * the review takes the narrowed read with its dates already worded, since a year and a day are dates, formatted where
 * the request's formats are. An unknown report, or another organization's, is the 404 screen (`TENANT_READ.NOT_FOUND`).
 */
export async function MigrationSection({ reportId }: { readonly reportId: string }) {
  const [t, format, read] = await Promise.all([
    getTranslations(MIGRATION_MESSAGES),
    getFormatter(),
    readReportMigration(reportId),
  ]);

  if (read.status === TENANT_READ.NOT_FOUND) notFound();
  if (read.status === TENANT_READ.FORBIDDEN) {
    await redirectToChoiceIfOwed();
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.REPORTS}>{t('permission.action')}</Link>
          </TextLink>
        }
      >
        {t('permission.body')}
      </Callout>
    );
  }
  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      // The body says to reload, which is this screen's whole remedy.
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={null}>
        {t('unreachable.body')}
      </Callout>
    );
  }

  const { report } = read;
  if (read.status === MIGRATION_READ.NOTHING_TO_DECIDE) {
    return (
      <MigrationFrame bar={<MigrationBar report={report} />}>
        <Callout
          intent={CALLOUT_INTENT.INFO}
          title={t('outcome.nothing.title')}
          action={
            <TextLink asChild>
              <Link href={reportRoute(report.id)}>{t('open')}</Link>
            </TextLink>
          }
        >
          {t('outcome.nothing.body')}
        </Callout>
      </MigrationFrame>
    );
  }

  const { subject } = report;
  return (
    <MigrationFrame bar={<MigrationBar report={report} />}>
      <MigrationReview
        reportId={report.id}
        entityId={subject.reportingEntityId}
        periodId={report.reportingPeriodId}
        entityName={subject.entityName}
        fiscalYear={format.dateTime(new Date(Date.UTC(subject.fiscalYear, 0, 1)), 'year')}
        from={read.review.from}
        to={read.review.to}
        movedOn={format.dateTime(new Date(read.review.migratedAt), 'long')}
        fields={read.review.fields}
      />
    </MigrationFrame>
  );
}
