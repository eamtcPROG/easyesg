import { STATUS_TONE, StatusChip, TextLink, type StatusTone } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, reportRoute, withQuery } from '@/lib/routes';
import { OVERVIEW_STANDING, type OverviewRow, type OverviewStanding } from '../../../tools/overview';
// Aliased to `MESSAGES` so every reader below is unchanged: the namespace was written privately
// here and in `overview-section.tsx`, and task 125's region split would have made that six copies.
import { OVERVIEW_MESSAGES as MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * S-05's filing row (UC-67, FR-23; task 32.4).
 *
 * **Here rather than in the route file**, which is `apps/web/CLAUDE.md`'s *"`app/` — routes only,
 * thin"* and the third step of UX-89: a component living in a screen has no state set, no dark
 * map, no expansion coverage and no accessibility review, and the next screen that needs it copies
 * all four omissions. Every sibling list in this app is already under `features/` —
 * `periods-list.tsx`, `reports-list.tsx`, `entities-list.tsx`, `access-list.tsx` — and the
 * stylesheet it reads was there while the component was not, which was the tell.
 *
 * **In `regions/` rather than in `shared/`** (task 126), and the two folders are told apart by one
 * question: *does more than one of these sibling folders read it?* The *attention* and *everything*
 * regions draw this row and nothing else on the screen does — the overview's other arms replace the
 * regions rather than compose them, so they never reach a row. `HomeRegion` was the
 * counter-example that made `shared/` necessary — `OverviewEmpty`, in `states/`, wears it too — and
 * task 128 moved it one level further out again, to `components/shared/`, once the memberships
 * region turned out to wear it as well. The test never changed, only which siblings it was asked
 * about.
 *
 * **It is not an inventory addition either, and that is UX-89's second step answered rather than
 * skipped.** §11.5's Data table is the Index archetype's — sortable, filterable, paginated, and a
 * client boundary, since its `cell` render functions cannot cross the RSC boundary at all. Each of
 * S-05's regions has exactly one order, and that order is its own question's; buying sorting the
 * screen does not ask for would make the most-visited page in the product a client boundary. So
 * this composes inventory primitives — `StatusChip`, `TextLink` — into a list, which is the shape
 * the membership region on the same screen has had since task 30.5.
 */


/**
 * The tone says **what this row asks of the reader**, and it agrees with S-06's map wherever the
 * two vocabularies overlap — two screens disagreeing about what *locked* looks like is worse than
 * either choice.
 *
 * `not_started`, `open` and `locked` share *neutral* and are told apart by their labels, which is
 * UX-102 working as intended: colour is never the sole carrier. `locked` in particular is not
 * alarming — locking is the deliberate act that gives a filing a defensible endpoint, and a warning
 * tone would tell a reader who did the right thing that they had erred. What *is* alarming here is
 * a deadline that has passed, and that is its own chip.
 *
 * Exhaustive by `Record`: a status added to the contract fails here rather than rendering with no
 * chip.
 */
const STANDING_TONE: Record<OverviewStanding, StatusTone> = {
  [OVERVIEW_STANDING.NOT_STARTED]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.IN_PROGRESS]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.LOCKED]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.READY_TO_FILE]: STATUS_TONE.PENDING,
  [OVERVIEW_STANDING.FILED]: STATUS_TONE.POSITIVE,
};

/**
 * One filing per row — entity, year, dates, deadline, standing, and the one thing this reader can
 * do with it.
 *
 * **The dates are the ISO days as stored, not reformatted**, which is `PeriodsList`'s and
 * `ReportsList`'s recorded position: NFR-26 wants a locale-derived format, §11.5 carries no
 * date-display component, and inventing one in a screen is the one-off UX-89 forbids. A third copy
 * of that reasoning is a signal — the component is task 32.1.1's `Date` grown a display mode, and
 * it belongs in `packages/ui` when a task owns it.
 *
 * **One action per row, and a viewer gets none where the action is a write.** Opening an existing
 * report is a read for everybody — S-07 draws its own read-only state (`READ_ONLY_CAUSE`) — while
 * starting one is a write `POST /reports` refuses a viewer, so offering it would be the control
 * that cannot act.
 */
export async function FilingList({
  rows,
  canWrite,
}: {
  readonly rows: readonly OverviewRow[];
  readonly canWrite: boolean;
}) {
  // Independent, so they do not queue (`async-parallel`). The standing gets its own narrow
  // namespace for the reason the page's arrival translator does: a template-literal key against a
  // wide namespace makes TypeScript infer a union over every leaf under it.
  const [t, tStanding] = await Promise.all([
    getTranslations(MESSAGES),
    getTranslations(`${MESSAGES}.standing`),
  ]);

  return (
    <ul className={styles.filings}>
      {rows.map((row) => (
        <li key={row.periodId} className={styles.filing}>
          <div className={styles.filingSubject}>
            <span className={styles.rowName}>{row.entityName}</span>
            <span className="t-numeric">
              {t('period', { start: row.periodStart, end: row.periodEnd })}
            </span>
          </div>

          <div className={styles.filingState}>
            <StatusChip tone={STANDING_TONE[row.standing]}>{tStanding(row.standing)}</StatusChip>
            {/* Overdue is a second chip rather than a tone on the first, because it is a different
                fact: *what state is this filing in* and *has its deadline passed* are independent,
                and folding them would lose one of the two. It carries words, so UX-102 holds. */}
            {row.overdue ? (
              <StatusChip tone={STATUS_TONE.ATTENTION}>{t('overdue')}</StatusChip>
            ) : null}
            <span className={`t-caption ${styles.sub}`}>
              {row.due === null ? t('dueNone') : t('due', { date: row.due })}
            </span>
          </div>

          <div className={styles.filingAction}>
            {row.reportId === null ? (
              canWrite && !row.periodLocked ? (
                <TextLink asChild>
                  {/* The creation flow's own address, with the entity already chosen — its two
                      decisions ride the query string precisely so a half-made one is a link. */}
                  <Link href={withQuery(ROUTES.REPORT_NEW, `entity=${row.entityId}`)}>
                    {t('start')}
                  </Link>
                </TextLink>
              ) : (
                /*
                 * **UX-13 in terms**: *"three different causes shall never produce one
                 * indistinguishable read-only screen"*. A locked period (UC-57) and a view-only
                 * membership (UC-17) both remove the row's action, and without this they left an
                 * identical row with no explanation of which applied. The third cause, a suspended
                 * entitlement (UC-142), is task 54's and is absent rather than guessed at.
                 *
                 * The lock is named because it is a fact about the filing that every reader needs;
                 * a viewer's own standing is stated once by the global tier's role rather than
                 * repeated on every row, which would be the same sentence N times.
                 */
                <span className={`t-caption ${styles.sub}`}>
                  {row.periodLocked ? t('periodLocked') : null}
                </span>
              )
            ) : (
              <TextLink asChild>
                {/* The report's own address, never a step: task 35.3's redirector resolves where
                    work last happened, so this screen never has an opinion about the position. */}
                <Link href={reportRoute(row.reportId)}>{t('open')}</Link>
              </TextLink>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
