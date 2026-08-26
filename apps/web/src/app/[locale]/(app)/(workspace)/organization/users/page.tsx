import { Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { AccessBoard } from '@/features/organization/components/access-board';
import { InviteMember } from '@/features/organization/components/invite-member';
import { applyAccessView, readAccessView } from '@/features/organization/access';
import styles from '@/features/organization/components/access.module.css';
import { ACCESS_READ, readOrganizationAccess } from '@/server/data/organization-access';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-16 — Users & access · OA · UC-59 … UC-64 · Index
 *
 * Answers "who can see our ESG data", and controls the answer. **One list across two collections**
 * — `identity.membership` and `identity.invitation` — because FR-56 asks for every user with access
 * "and their status, active or pending invitation", and task 25.1's migration recorded that the
 * union belongs in the read model. Removing someone ends their access without erasing their
 * attributed contributions (UC-63, FR-59), which the confirmation says before it happens (UX-69).
 *
 * **The screen never computes the caller's role.** Both API controllers carry
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level, so an editor or a viewer is refused
 * and this renders the permission state from that refusal. One fewer round trip than reading
 * `/memberships` first, and one fewer place for this tier's belief about a role to disagree with
 * the server's.
 *
 * **Two omissions, both recorded rather than silent.** The seat-consumption region and UX-50's
 * entitlement gate are task 54.2's: UX-50 requires the limit, the allowance, current consumption
 * and the upgrade path *in that order*, and only consumption is knowable before `EntitlementPort`
 * has an implementation — a partial region would invite a reader to infer a ceiling nothing is
 * checking. And UC-175's manual reminder is task 50's, which now owns it; it appeared in this
 * screen's controls and in no task at all until this one was built.
 *
 * States (§8.1): ready · empty — first use · empty — filtered · error — permission · error —
 * recoverable. Loading is `loading.tsx`; the transient states of an action are the board's.
 */
const MESSAGES = 'organization.access';

/** The invite panel's heading, so the first-use empty state can send a reader straight to it. */
const INVITE_ANCHOR = 'invite-a-colleague';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function UsersAndAccessPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations(MESSAGES);

  // Independent: the query string is already in hand and the read is an API round trip, so the
  // parse does not wait on the fetch (`async-parallel`).
  const [query, read] = await Promise.all([searchParams, readOrganizationAccess()]);

  return (
    <div className={styles.screen}>
      <header>
        <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </header>

      <AccessScreenBody read={read} query={query} />
    </div>
  );
}

/**
 * The three arms of the read, as a top-level component rather than a closure — the shape
 * `rerender-no-inline-components` names. It does not strictly fire in a Server Component, but the
 * habit it exists to break is reaching for the enclosing scope instead of passing what is needed.
 */
async function AccessScreenBody({
  read,
  query,
}: {
  readonly read: Awaited<ReturnType<typeof readOrganizationAccess>>;
  readonly query: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === ACCESS_READ.FORBIDDEN) {
    return (
      <Callout
        intent="warning"
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

  if (read.status === ACCESS_READ.UNREACHABLE) {
    return (
      <Callout
        intent="error"
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  // The clock comes from the read, not from here: one tick for the whole page, so a row sitting on
  // its expiry cannot be filtered as live and labelled as lapsed. It is also the honest instant —
  // the standing is a fact about the data as read, not about when React got round to rendering it.
  const view = readAccessView(query);
  const page = applyAccessView({ rows: read.rows, view, now: read.readAt });

  return (
    <>
      <AccessBoard page={page} view={view} now={read.readAt} inviteAnchorId={INVITE_ANCHOR} />
      <InviteMember id={INVITE_ANCHOR} />
    </>
  );
}
