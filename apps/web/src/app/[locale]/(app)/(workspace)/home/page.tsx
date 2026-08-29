import {
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
import styles from '@/features/organization/components/home.module.css';
import { readMemberships } from '@/server/memberships';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-05 — Home / organization overview · all actors · UC-16, UC-67 · Workspace
 *
 * At `/{locale}/home`, not `/{locale}`: the marketing home holds the locale root because it is the
 * SEO landing page and the only page §14.2 permits to be cached, and Next rejects two route groups
 * resolving to one path. If the host split the design set implies is later confirmed, `/home`
 * becomes `/` on the tenant host behind a redirect.
 *
 * **Two amendments taken with this task** (29 Aug 2026, project owner, `design_spec.md` S-05):
 *
 *  - **UX-6's three regions ship as one.** *What needs my attention*, *where did I leave off* and
 *    *what is the state of everything* are three questions about reports, and reports arrive with
 *    task 31. Three empty boxes above the fold teach a reader that two thirds of their home is
 *    broken; one region named for what it will hold says the product is unfinished here, which is
 *    true and which §4.6 asks an empty state to *teach*. Task 32.4 splits it into UX-6's order.
 *  - **The heading names the organization, not the reader.** The artboard's *"Good afternoon,
 *    Ana"* needs a display name registration does not collect (OQ-16, open) and a time of day this
 *    Server Component cannot know for the reader.
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
 */
const MESSAGES = 'organization.home';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function HomePage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const [query, memberships, t, tRoles, tArrival] = await Promise.all([
    searchParams,
    readMemberships(),
    getTranslations(MESSAGES),
    getTranslations('organization.access.roles'),
    // Its own translator, scoped to the three grants. A `t(`arrival.${grant}.title`)` against the
    // whole namespace makes TypeScript infer a template-literal key union over every leaf under it
    // — which it refuses as "too complex to represent". Narrowing the namespace narrows the union.
    getTranslations('organization.home.arrival'),
  ]);

  const arrival = readArrival(query.joined);
  const active = memberships?.find((membership) => membership.active) ?? null;

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

      {/* UC-67 and FR-23, explicitly empty. Named for what it will hold rather than left out, so
          32.4 does not have to introduce the concept cold — and honest about why it is empty, which
          is that no reporting period exists rather than that nothing is happening. */}
      <Panel>
        <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('reports.heading')}</h2>
        <EmptyState title={t('reports.empty.title')} action={null}>
          {t('reports.empty.body')}
        </EmptyState>
      </Panel>

      <MembershipsRegion memberships={memberships} />
    </div>
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
