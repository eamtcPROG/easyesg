import {
  Button,
  Callout,
  CALLOUT_INTENT,
  EmptyState,
  Panel,
  Skeleton,
  SKELETON_SHAPE,
  TextLink,
} from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, reportRoute } from '@/lib/routes';
import { mayWrite, readActiveMembership } from '@/server/memberships';
import { readOrganizationPeriods } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { attentionRows, everythingRows, resumableRow, toOverviewRows } from '../overview';
import { FilingList } from './filing-list';
import styles from './home.module.css';

/**
 * UX-6's three questions, in UX-6's order — UC-67 and FR-23 (task 32.4).
 *
 * **The overview is one read of `GET /periods`, and the row is a period rather than a report.**
 * FR-23 lists every entity *and period*, and since task 31.3 a report is an explicit creation — so
 * the row this screen most needs is a period with a deadline nobody has started, which
 * `GET /reports` cannot see. `architecture.md` §12.5.6 carries the widening and the two columns it
 * refuses: completion is task 41.3's roll-up and validation findings are task 40's, absent here
 * rather than drawn empty, exactly as S-06 refused the same two.
 *
 * **This is the screen's one Suspense boundary, and it is the only region that earns one.** The
 * other three regions read memberships, which is React-`cache()`d and already in flight for the
 * global tier; this one makes an HTTP call nothing else on the page makes. Wrapping it lets the
 * heading and the membership list paint while the filings stream in, which is
 * `async-suspense-boundaries` applied where its own "when NOT to use" list does not bite: below the
 * fold, not layout-defining, and a genuinely slow read.
 *
 * **`now` is read once, here, and threaded into the rules.** Two regions ask whether a deadline has
 * passed; reading the clock in each would let one region call a filing overdue while the other did
 * not, on a request that happens to straddle midnight in the period's zone. That is also why the
 * three regions are **one component and not three boundaries** — splitting them would give each its
 * own clock and its own `toOverviewRows`, which is the same defect wearing a refactor's clothes.
 *
 * **No `DataTable`, and that is not an omission.** `DataTable` exists for the Index archetype —
 * sortable, filterable, paginated — and takes `cell` render functions, which a Server Component
 * cannot hand across the RSC boundary at all; using it would make the most-visited screen in the
 * product a client boundary to buy sorting UX-6 does not ask for, since each region has one order
 * and it is the question's own.
 *
 * States (§8.1) it owns: ready · read-only (a view-only membership drops the actions, FR-25) ·
 * empty — first use · error — permission · error — recoverable.
 */
const MESSAGES = 'organization.home.overview';

export async function OverviewSection() {
  // Independent, so they do not queue (`async-parallel`). The membership read is free — it is the
  // same memoized promise the heading and the global tier are already awaiting — so what this
  // boundary is actually waiting on is `GET /periods` alone.
  const [read, membership, t] = await Promise.all([
    readOrganizationPeriods(),
    readActiveMembership(),
    getTranslations(MESSAGES),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      // UX-1's boundary state names who can grant access, so the remedy is in the message and the
      // slot says so rather than repeating it — `apps/web/CLAUDE.md`'s `action={null}` rule.
      <Panel>
        <Callout intent={CALLOUT_INTENT.WARNING} title={t('forbidden.title')} action={null}>
          {t('forbidden.body')}
        </Callout>
      </Panel>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Panel>
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t('unreachable.title')}
          action={t('unreachable.action')}
        >
          {t('unreachable.body')}
        </Callout>
      </Panel>
    );
  }

  // FR-25's clause, read literally: the entries are unchanged for a viewer and only the writes go.
  // The predicate lives beside the read (`server/memberships.ts`) rather than here — S-06 had its
  // own copy in the opposite conjunct order, which is one rule spelled two ways.
  const canWrite = mayWrite(membership);
  const rows = toOverviewRows({ periods: read.periods, now: new Date() });

  if (rows.length === 0) {
    // §4.6's first-use state: it teaches the object and offers the one action that creates it.
    // **The offer is the entities screen, not a period form** — a period is opened against an
    // entity (FR-21), so an organization with no entity cannot be sent straight to one.
    return (
      <Panel>
        <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('everything.heading')}</h2>
        <EmptyState
          title={t('empty.title')}
          action={
            canWrite ? (
              <Button asChild>
                <Link href={ROUTES.ENTITIES}>{t('empty.action')}</Link>
              </Button>
            ) : null
          }
        >
          {t('empty.body')}
        </EmptyState>
      </Panel>
    );
  }

  const attention = attentionRows(rows);
  const resume = resumableRow(rows);

  return (
    <>
      <Panel>
        <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('attention.heading')}</h2>
        {attention.length === 0 ? (
          // Not a failure state: this is UC-67's question answered *yes*, which is the one answer
          // the screen exists to be able to give.
          <EmptyState title={t('attention.empty.title')} action={null}>
            {t('attention.empty.body')}
          </EmptyState>
        ) : (
          <>
            <p className={`t-body ${styles.lede}`}>{t('attention.lede')}</p>
            <FilingList rows={attention} canWrite={canWrite} />
          </>
        )}
      </Panel>

      {/*
        Rendered only when there is one: a region headed *where did I leave off* over an empty box
        answers a question nobody asked, and UX-6 orders three questions rather than requiring three
        boxes.

        **A sentence and a link, deliberately not a fourth copy of the row.** UX-6 says a
        single-entity organization *"reduces to one resumable report and its completion state"* —
        one thing, not the same row drawn three times, which is what a `FilingList` here would
        produce on the commonest shape in the product. The three regions answer three questions and
        each takes the shape its own question has.
      */}
      {resume === null ? null : (
        <Panel>
          <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('resume.heading')}</h2>
          <p className={`t-body ${styles.lede}`}>
            {t('resume.body', {
              entity: resume.entityName,
              // **A string, because ICU formats a bare number.** `2026` passed as a number renders
              // as "2 026" in `ro`/`ru` and "2,026" in `en` — the space thousands separator §11
              // asks for everywhere else, in the one place it is wrong. `i18n/formats.ts`'s `year`
              // format records the same trap; here the value never leaves the message.
              year: String(resume.fiscalYear),
            })}
          </p>
          <TextLink asChild>
            <Link href={reportRoute(resume.reportId)}>{t('resume.action')}</Link>
          </TextLink>
        </Panel>
      )}

      <Panel>
        <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('everything.heading')}</h2>
        <p className={`t-body ${styles.lede}`}>{t('everything.lede')}</p>
        <FilingList rows={everythingRows(rows)} canWrite={canWrite} />
      </Panel>
    </>
  );
}

/**
 * The boundary's fallback — §8.1's `loading — initial`, which the model defines as *"skeleton
 * matching final layout; no layout shift on resolve"* and S-05's own row repeats verbatim.
 *
 * **It matches the region's commonest shape rather than its widest**, which is the judgement
 * "matching the final layout" leaves once a region can resolve four ways. The three-panel answer is
 * what an organization with filings gets and what every reader sees on every visit after their
 * first; the other three — a teaching empty state, a permission callout, a recoverable-error
 * callout — are each a panel too, so the shift on those arms is a panel's height rather than a
 * screen's. **A spinner was built first and was wrong**: UX-115's second sentence reserves spinners
 * for *"indeterminate waits with no known shape"*, and this shape is known — the uncertainty is over
 * which of four, not over whether there is one.
 *
 * **Synchronous, and the labels arrive as props — a fallback may not await.** An async fallback is a
 * component that can itself suspend, and it would suspend against the *parent* boundary: the shell
 * would wait for exactly what the boundary below it exists to stop waiting for. That is why S-05's
 * route file still opens one translator after the split.
 *
 * **The bars are `aria-hidden` and one sentence carries the wait.** A screen reader hears *"the
 * reporting status is loading"* once, rather than counting grey rectangles (UX-102); the sentence is
 * visually hidden because the skeleton is what a sighted reader is already being told by.
 */
export function OverviewLoading({ label }: { readonly label: string }) {
  return (
    <Panel>
      <p className={styles.loadingLabel} role="status">
        {label}
      </p>
      <Skeleton shape={SKELETON_SHAPE.HEADING} className={styles.loadingHeading} />
      <Skeleton className={styles.loadingLede} />
      {/* Three rows: `FilingList`'s own shape, at the count an organization with one entity and
          three periods shows — the commonest filing list in the product, and the reason this
          resolves without moving anything under it. */}
      <div className={styles.loadingRows}>
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
        <Skeleton shape={SKELETON_SHAPE.BLOCK} />
      </div>
    </Panel>
  );
}
