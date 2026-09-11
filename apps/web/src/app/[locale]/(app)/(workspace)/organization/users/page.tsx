import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { AccessBoard } from '@/features/organization/access/components/access-board';
import { AccessProvider } from '@/features/organization/access/components/access-context';
import { InviteMember } from '@/features/organization/access/components/invite-member';
import { readAccessView, type AccessView } from '@/features/organization/access/tools/access';
import styles from '@/features/organization/access/components/access.module.css';
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

  // **Sequential now, and the dependency is real** (task 131). These used to be a `Promise.all`,
  // because the read fetched both collections whole and the query string only decided what to do
  // with them afterwards. The filter, the order and the page are the API's now, so the request
  // cannot be made until the view is parsed. `async-parallel` is about *independent* work; forcing
  // these to overlap would mean fetching a page nobody asked for.
  const view = readAccessView(await searchParams);
  const read = await readOrganizationAccess(view);

  return (
    <div className={styles.screen}>
      <hgroup>
        <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
      </hgroup>

      <AccessScreenBody read={read} view={view} />
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
  view,
}: {
  readonly read: Awaited<ReturnType<typeof readOrganizationAccess>>;
  readonly view: AccessView;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === ACCESS_READ.FORBIDDEN) {
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

  if (read.status === ACCESS_READ.UNREACHABLE) {
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

  // **No clock here any more.** The standing used to be judged against the instant of the read, so
  // a row sitting on its expiry could not be filtered as live and labelled as lapsed. It is now
  // derived by the database in the same statement that filters and orders on it, which is the same
  // guarantee with one fewer place to keep it — and one fewer clock in this tier.
  return (
    <>
      {/* One provider over BOTH regions (28 Aug 2026). It used to sit inside `AccessBoard`, which
          left the invite panel holding an outcome of its own that nothing else could clear — so a
          settled invite notice survived a row action starting, and two callouts could show at
          once. The screen holds one notice; each region renders it only when it is theirs. */}
      {/* Its own provider since task 99 — see `i18n/client-messages.ts`. */}
      <AccessProvider page={read.page} view={view} inviteAnchorId={INVITE_ANCHOR}>
        <AccessBoard />
        <InviteMember id={INVITE_ANCHOR} />
      </AccessProvider>
    </>
  );
}
