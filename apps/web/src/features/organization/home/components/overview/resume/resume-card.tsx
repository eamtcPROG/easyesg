import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import type { AccountMembership } from '@easyesg/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { groupCount, moduleChecksOf, modulesInScope } from '@/features/wizard/tools/module-state';
import { moduleLabel } from '@/features/wizard/tools/module-words';
import { reportIdentity } from '@/features/wizard/tools/report-identity';
import { Link } from '@/i18n/navigation';
import { calendarDay } from '@/lib/legal-date';
import { reportRoute, reportStepRoute } from '@/lib/routes';
import { mayWrite } from '@/server/data/memberships';
import { readReportProgress } from '@/server/data/report-progress';
import { TENANT_READ } from '@/server/data/tenant-read';
import { resumeModule } from '@/server/data/wizard';
import { hasAnswers, moduleStrip } from '../../../tools/module-strip';
import { OVERVIEW_STANDING, type ResumableRow } from '../../../tools/overview';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { ResumeCardUnreachable } from './resume-card-unreachable';
import { ResumeLegend } from './resume-legend';
import { ResumeStrip } from './resume-strip';
import styles from '../../styles/home.module.css';

/**
 * The resume card (task 255): the report's title, its period, *N / M modules complete*, the strip of its modules, and
 * where work stopped with the way back to it — `EasyESG Workspace.dc.html`'s S-05, built from what S-07 reads.
 *
 * **Every fact is the wizard's, through the wizard's own functions.** The title is `reportIdentity`'s (S-07's bar),
 * the count is `groupCount`'s (S-07's list), each module's state is `moduleStateOf`'s and where work stopped is
 * `resumeModule`'s — the redirector the report's own address resolves through — so *continue B8* here lands where
 * opening the report would. A second spelling of any of them would let the home and the wizard disagree.
 *
 * **Continue, or open.** A member who may write, on a report that takes writes, continues; a viewer or a locked
 * report is offered the same place to *open*, since S-07 draws its own read-only state there and *continue* would
 * promise work the screen will not take.
 */
export async function ResumeCard({
  row,
  membership,
}: {
  readonly row: ResumableRow;
  readonly membership: AccountMembership | null;
}) {
  const [progress, t, tWizard, tReports, format] = await Promise.all([
    readReportProgress(row.reportId),
    getTranslations(`${OVERVIEW_MESSAGES}.resume`),
    getTranslations(WIZARD_MESSAGES),
    getTranslations('organization.reports'),
    getFormatter(),
  ]);

  if (progress.status !== TENANT_READ.READY) return <ResumeCardUnreachable row={row} />;

  const { report, modules, validation } = progress;
  const checks = moduleChecksOf(validation);
  const asked = modulesInScope({ modules, scope: report.scope });
  const current = resumeModule(asked);
  const strip = moduleStrip({ modules, checks, scope: report.scope, current });
  const { done, counted } = groupCount({ modules: asked, checks });
  const { title } = reportIdentity({ report, t: tWizard, tReports, format });
  const period = format.dateTimeRange(
    calendarDay(report.subject.periodStart),
    calendarDay(report.subject.periodEnd),
    'calendar',
  );
  const continues = mayWrite(membership) && !row.periodLocked && row.standing !== OVERVIEW_STANDING.LOCKED;
  const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;

  return (
    <div className={`${styles.card} ${styles.emphatic} ${styles.cardInset}`}>
      <div className={styles.resumeHead}>
        <div className={styles.resumeIdentity}>
          <p className={styles.eyebrow}>{tReports(`status.${report.status}`)}</p>
          <h3 className={`t-heading-2 ${styles.resumeTitle}`}>{title}</h3>
          <p className={`t-body ${styles.resumeMeta}`}>
            {t('meta', { entity: report.subject.entityName, period })}
          </p>
        </div>
        <p className={styles.resumeCount}>
          <span className={`t-heading-1 ${styles.resumeFigure}`}>
            {format.number(done, 'integer')}
            <span className={styles.resumeTotal}>{t('total', { counted: format.number(counted, 'integer') })}</span>
          </span>
          <span className={`t-caption ${styles.muted}`}>{t('complete')}</span>
        </p>
      </div>

      <ResumeStrip strip={strip} />
      <ResumeLegend strip={strip} />

      <div className={styles.resumeFoot}>
        {current === undefined ? null : (
          <p className={`t-body ${styles.resumeSentence}`}>
            {hasAnswers(asked)
              ? t.rich('stopped', { module: moduleLabel(tWizard, current), strong })
              : t.rich('starts', { module: moduleLabel(tWizard, current), strong })}
          </p>
        )}
        <div className={styles.resumeActions}>
          <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
            <Link href={reportRoute(report.id)}>{t('allModules')}</Link>
          </Button>
          <Button asChild>
            {current === undefined ? (
              <Link href={reportRoute(report.id)}>{t('continueReport')}</Link>
            ) : (
              <Link href={reportStepRoute({ reportId: report.id, module: current })}>
                {continues ? t('continue', { module: current }) : t('open', { module: current })}
              </Link>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
