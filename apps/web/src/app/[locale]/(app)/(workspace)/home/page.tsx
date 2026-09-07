import {
  Button,
  Callout,
  CALLOUT_INTENT,
  EmptyState,
  Panel,
  STATUS_TONE,
  StatusChip,
  TextLink,
} from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import type { AccountMembership } from '@easyesg/contracts';
import { readArrival } from '@/features/organization/home';
import { FilingList } from '@/features/organization/components/filing-list';
import {
  attentionRows,
  everythingRows,
  resumableRow,
  toOverviewRows,
} from '@/features/organization/overview';
import styles from '@/features/organization/components/home.module.css';
import { mayWrite, readActiveMembership, readMemberships } from '@/server/memberships';
import { readOrganizationPeriods, type OverviewRead } from '@/server/data/periods';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES, reportRoute } from '@/lib/routes';

/**
 * S-05 — Home / organization overview · all actors · UC-16, UC-67 · Workspace
 *
 * At `/{locale}/home`, not `/{locale}`: the marketing home holds the locale root because it is the
 * SEO landing page and the only page §14.2 permits to be cached, and Next rejects two route groups
 * resolving to one path. If the host split the design set implies is later confirmed, `/home`
 * becomes `/` on the tenant host behind a redirect.
 *
 * **Task 32.4 splits UX-6's three regions, which is what task 30.5 deferred.** That task shipped
 * one explicitly-empty region because all three are report-derived and reports did not exist; they
 * do now, so *what needs my attention*, *where did I leave off* and *what is the state of
 * everything* are three regions in that order. The amendment is recorded on `design_spec.md`'s S-05.
 *
 * **The heading still names the organization, not the reader** (task 30.5, unchanged): the
 * artboard's *"Good afternoon, Ana"* needs a display name registration does not collect (OQ-16,
 * open) and a time of day this Server Component cannot know for the reader.
 *
 * **The overview is one read of `GET /periods`, and the row is a period rather than a report.**
 * FR-23 lists every entity *and period*, and since task 31.3 a report is an explicit creation — so
 * the row this screen most needs is a period with a deadline nobody has started, which
 * `GET /reports` cannot see. `architecture.md` §12.5.6 carries the widening and the two columns it
 * refuses: completion is task 41.3's roll-up and validation findings are task 40's, absent here
 * rather than drawn empty, exactly as S-06 refused the same two.
 *
 * **No `DataTable`, and that is not an omission.** `DataTable` exists for the Index archetype —
 * sortable, filterable, paginated — and takes `cell` render functions, which a Server Component
 * cannot hand across the RSC boundary at all; using it would make the most-visited screen in the
 * product a client boundary to buy sorting UX-6 does not ask for, since each region has one order
 * and it is the question's own. The regions are lists of inventory primitives inside `Panel`s,
 * which is the shape the memberships region below has had since task 30.5 (UX-89: reuse, and a
 * difference in *anatomy* is what an inventory addition needs).
 *
 * **OQ-6 is why the membership list is here at all**: UC-16 is two behaviours, and this screen owns
 * *viewing* while the global tier owns *switching* (task 83). So the list states where the reader
 * belongs and what role they hold in each, and does not act — which is information, not a control
 * that cannot act.
 *
 * **S-35's wording is deliberately not repeated.** That screen exists for the sign-in-time failure
 * where nothing resolved; here a failed read means the reader is already inside an organization and
 * only the list is missing, so this says *that*, and task 25.4's recorded obligation is discharged
 * by the two states saying different things rather than by one of them being silent.
 *
 * States (§8.1): ready · read-only (view-only membership) · empty — first use · partial (the two
 * reads fail independently, each with its own message) · error — permission · error — recoverable.
 */
const MESSAGES = 'organization.home';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function HomePage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  // Independent, so they do not queue (`async-parallel`). `readMemberships` and
  // `readActiveMembership` are React-`cache()`d and the global tier has already read them.
  const [query, memberships, overview, membership, t, tRoles, tArrival] = await Promise.all([
    searchParams,
    readMemberships(),
    readOrganizationPeriods(),
    readActiveMembership(),
    getTranslations(MESSAGES),
    getTranslations('organization.access.roles'),
    // Its own translator, scoped to the three grants. A `t(`arrival.${grant}.title`)` against the
    // whole namespace makes TypeScript infer a template-literal key union over every leaf under it
    // — which it refuses as "too complex to represent". Narrowing the namespace narrows the union.
    getTranslations('organization.home.arrival'),
  ]);

  const arrival = readArrival(query.joined);
  const active = memberships?.find((membership) => membership.active) ?? null;
  // FR-25's clause, read literally: the entries are unchanged for a viewer and only the writes go.
  // The predicate lives beside the read (`server/memberships.ts`) rather than here — S-06 had its
  // own copy in the opposite conjunct order, which is one rule spelled two ways.
  const canWrite = mayWrite(membership);

  return (
    <div className={styles.screen}>
      {arrival ? (
        // UC-15's outcome, stated. `already_member` is the one this exists for: without it that
        // reader sees exactly the landing a new member sees, having clicked a link that told them
        // nothing.
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={tArrival(`${arrival}.title`)} action={null}>
          {tArrival(`${arrival}.body`)}
        </Callout>
      ) : null}

      <header>
        <h1 className={`t-heading-1 ${styles.title}`}>{active ? active.organizationName : t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>
          {active ? tRoles(active.role) : t('lede')}
        </p>
      </header>

      <OverviewRegions read={overview} canWrite={canWrite} />
      <MembershipsRegion memberships={memberships} />
    </div>
  );
}

/**
 * UX-6's three questions, in UX-6's order — UC-67 and FR-23 (task 32.4).
 *
 * A top-level component rather than a closure, which is the shape `rerender-no-inline-components`
 * names and every page in this phase makes.
 *
 * **`now` is read once, here, and threaded into the rules.** Two regions ask whether a deadline has
 * passed; reading the clock in each would let one region call a filing overdue while the other did
 * not, on a request that happens to straddle midnight in the period's zone.
 */
async function OverviewRegions({
  read,
  canWrite,
}: {
  readonly read: OverviewRead;
  readonly canWrite: boolean;
}) {
  const t = await getTranslations(`${MESSAGES}.overview`);

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
 * UC-16's *view memberships* half (FR-12), as a top-level component rather than a closure — the
 * shape `rerender-no-inline-components` names, and every page in this phase makes the same move.
 */
async function MembershipsRegion({
  memberships,
}: {
  readonly memberships: readonly AccountMembership[] | null;
}) {
  const [t, tRoles] = await Promise.all([
    getTranslations(MESSAGES),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <Panel>
      <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('memberships.heading')}</h2>

      {memberships === null ? (
        // Not S-35's sentence. There, sign-in resolved nothing and the reader has nowhere to be;
        // here they are already inside an organization and one region did not load.
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t('memberships.unreachable.title')}
          action={t('memberships.unreachable.action')}
        >
          {t('memberships.unreachable.body')}
        </Callout>
      ) : (
        <>
          <p className={`t-body ${styles.lede}`}>{t('memberships.lede')}</p>
          <ul className={styles.memberships}>
            {memberships.map((membership) => (
              <li key={membership.id} className={styles.membership}>
                <span className={styles.membershipName}>{membership.organizationName}</span>
                <span className={`t-caption ${styles.sub}`}>{tRoles(membership.role)}</span>
                {/* The active one is marked in words as well as by the chip: colour is never the
                    sole carrier (UX-102), and this list has no other way to say which is which
                    until task 83's switcher makes it choosable. */}
                {membership.active ? (
                  <StatusChip tone={STATUS_TONE.POSITIVE}>{t('memberships.active')}</StatusChip>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={`t-caption ${styles.sub}`}>
        {t.rich('memberships.switchNote', {
          organization: (chunks) => (
            <TextLink asChild>
              <Link href={ROUTES.ORGANIZATION}>{chunks}</Link>
            </TextLink>
          ),
        })}
      </p>
    </Panel>
  );
}
