import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { readReportCreation } from '@/server/data/reports';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { creationChoice } from '../tools/report-creation';
import { NewReportDecisions } from './new-report-decisions';
import { REPORT_CREATION_MESSAGES } from './reports-messages';
import styles from './reports.module.css';

/**
 * Report creation's one region: the choices read off the address, the read, and which of §8.1's
 * arms applies (UC-18; task 32.3, cut out of the route by task 134).
 *
 * **The section reads; the parts render.** This file does what no part can — parse the address,
 * make the read and choose the arm — and `NewReportDecisions` takes the narrowed read. The
 * permission and unreachable arms are two callouts, each with §11.5's three parts: the first draft
 * of this screen folded two of them into a title and passed `null` for the body, which compiles and
 * leaves the reader the "so what" to infer.
 */
export async function NewReportSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId, periodId } = creationChoice(await searchParams);
  const [read, t] = await Promise.all([
    readReportCreation(entityId),
    getTranslations(REPORT_CREATION_MESSAGES),
  ]);

  // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
  if (read.status === TENANT_READ.FORBIDDEN) await redirectToChoiceIfOwed();

  return (
    <div className={styles.screen}>
      {/* No `styles.header`: that class is the two-column row for a screen with an action beside
          its title, and this screen has none. `hgroup` admits only a heading and `p`s. */}
      <hgroup>
        <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </hgroup>

      {read.status === TENANT_READ.FORBIDDEN ? (
        <Callout
          intent={CALLOUT_INTENT.WARNING}
          title={t('permission.title')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.HOME}>{t('permission.action')}</Link>
            </TextLink>
          }
        >
          {t('permission.body')}
        </Callout>
      ) : read.status === TENANT_READ.UNREACHABLE ? (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t('unreachable.title')}
          // The body already says to reload, which is this screen's whole remedy.
          action={null}
        >
          {t('unreachable.body')}
        </Callout>
      ) : (
        <NewReportDecisions read={read} entityId={entityId} periodId={periodId} />
      )}
    </div>
  );
}
