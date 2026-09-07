import { Button, Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { ReportsList } from '@/features/reports/components/reports-list';
import {
  applyReportView,
  readReportView,
  reportFilterOptions,
} from '@/features/reports/reports';
import styles from '@/features/reports/components/reports.module.css';
import { readReportList, type ReportListRead } from '@/server/data/reports';
import { mayWrite, readActiveMembership } from '@/server/memberships';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-06 — Reports index · RC, OA · UC-17 · Index (task 32.2.2)
 *
 * Which reports are open to this member, and where each one stands (FR-25).
 *
 * **Three of the artboard's six columns belong to other tasks and are refused rather than
 * invented**, which is the parent row's own decision with its owners recorded: completion is task
 * 41.3's roll-up, validation findings are task 40's, and the export count beneath a filed row is
 * task 47's. The *Last activity* column ships half-built on purpose — the instant without the
 * actor, because `GET /reports` answers no actor and provenance (§6.13, FR-55) reaches a screen
 * only when a read answers it.
 *
 * **This screen was blocked until S-07 became real** (task 32.2.2's row): §4.4 has no report record
 * screen, so an Index row's only exit is the wizard, and pointing the busiest list in the product
 * at a redirector returning nothing is the dead row action task 30.1 ruled against. Tasks 35.1 …
 * 36.2 built that exit; `reports/[reportId]/page.tsx` now resolves to a step and redirects.
 *
 * **It DOES read the caller's role, and that is where this screen differs from S-13 and S-15.**
 * Those two carry no read-only state a producer exists for — S-13's is entitlement-reduced entities,
 * task 54's. S-06's is *view-only membership*, which FR-25 states as an acceptance criterion —
 * *"a view-only member sees the same entries and no edit affordances"* — and §5's own States row
 * lists as `read-only (view-only membership)`. The role is already in hand and `cache()`d, so the
 * first draft's *"the screen never computes the caller's role"* was a rule carried from screens
 * where it holds to the one screen where the requirement says otherwise.
 *
 * The entries are unchanged for a viewer; only the two writes disappear — which is the clause read
 * literally, and is why the read stays open to every member (§12.5.6's task-32.2.1 row makes the
 * same point from the API's side).
 *
 * States (§8.1): ready · read-only (view-only membership) · empty — first use · empty — filtered ·
 * error — permission · error — recoverable. The two empty states are `ReportsList`'s, because §4.6
 * requires them to teach and teaching means naming this object.
 */
const MESSAGES = 'organization.reports';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function ReportsIndexPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations(MESSAGES);
  // Independent: the query string is already in hand and the read is an API round trip, so the
  // parse does not wait on the fetch (`async-parallel`).
  const [query, read, membership] = await Promise.all([
    searchParams,
    readReportList(),
    // Independent of all three — and free, because `readMemberships` is React-`cache()`d and the
    // global tier has already read it this render pass.
    readActiveMembership(),
  ]);
  // FR-25's clause. The predicate — including why an absent membership reads as view-only — lives
  // beside the membership read, so S-05 and this screen cannot answer it differently (task 32.4).
  const canCreate = mayWrite(membership);

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

      <ReportsScreenBody read={read} query={query} canCreate={canCreate} />
    </div>
  );
}

/**
 * The read's three arms, as a top-level component rather than a closure — the shape
 * `rerender-no-inline-components` names, and every other Index page here makes the same move.
 */
async function ReportsScreenBody({
  read,
  query,
  canCreate,
}: {
  readonly read: ReportListRead;
  readonly query: Record<string, string | string[] | undefined>;
  /** FR-25: a view-only member sees the same entries and no edit affordances. */
  readonly canCreate: boolean;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
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
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  const view = readReportView(query);
  const page = applyReportView({ rows: read.rows, view });
  // **The filter's options come from the rows, not from a second read.** A filter that offered an
  // entity with no report would answer *nothing matches* for a value the reader was invited to
  // choose, which is the filtered empty state used as a dead end rather than as a remedy.
  const options = reportFilterOptions(read.rows);

  return (
    <ReportsList
      page={page}
      view={view}
      entities={options.entities}
      years={options.years}
      canCreate={canCreate}
    />
  );
}
