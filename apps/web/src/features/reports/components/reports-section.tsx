import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { mayWrite, readActiveMembership } from '@/server/data/memberships';
import { readReportList } from '@/server/data/reports';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { applyReportView, readReportView, reportFilterOptions } from '../tools/reports';
import { ReportsList } from './reports-list';
import { REPORTS_MESSAGES } from './reports-messages';
import styles from './reports.module.css';

/**
 * S-06's one region: the reads, the header whose action depends on them, and which of §8.1's arms
 * applies (UC-17; task 32.2.2, cut out of the route by task 134's parent-close review).
 *
 * **The section reads; the parts render.** The query string is in hand, the list is an API round
 * trip and the membership is React-`cache()`d and already read by the global tier, so all run
 * together (`async-parallel`). **It DOES read the caller's role**, which is where this screen
 * differs from S-13 and S-15: FR-25 states *"a view-only member sees the same entries and no edit
 * affordances"* as an acceptance criterion, so `mayWrite` — the one predicate S-05 and this screen
 * share — decides the add button and the list's write affordances. The entries are unchanged for a
 * viewer; only the writes disappear. **The filter's options come from the rows, not a second
 * read**: a filter offering an entity with no report would answer *nothing matches* for a value
 * the reader was invited to choose.
 */
export async function ReportsSection({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, read, membership, t] = await Promise.all([
    searchParams,
    readReportList(),
    readActiveMembership(),
    getTranslations(REPORTS_MESSAGES),
  ]);
  const canCreate = mayWrite(membership);

  let body: ReactNode;
  if (read.status === TENANT_READ.FORBIDDEN) {
    body = (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  } else if (read.status === TENANT_READ.UNREACHABLE) {
    body = (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  } else {
    const view = readReportView(query);
    const page = applyReportView({ rows: read.rows, view });
    const options = reportFilterOptions(read.rows);
    body = (
      <ReportsList
        page={page}
        view={view}
        entities={options.entities}
        years={options.years}
        canCreate={canCreate}
      />
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        </div>
        {read.status === TENANT_READ.READY && canCreate ? (
          <Button asChild>
            <Link href={ROUTES.REPORT_NEW}>{t('add')}</Link>
          </Button>
        ) : null}
      </header>
      {body}
    </div>
  );
}
