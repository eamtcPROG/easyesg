import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Button, Callout, Panel, TextLink } from '@easyesg/ui';
import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { AcceptInvitation } from '@/features/identity/components/accept-invitation';
import { InvitationSummary } from '@/features/identity/components/invitation-summary';
import { SocialProviders } from '@/features/identity/components/social-providers';
import { previewInvitationAction, signOutAction } from '@/features/identity/actions';
import {
  INVITATION_VIEW,
  invitationHandOff,
  invitationView,
  type InvitationView,
  type UnusableStanding,
  type UsableInvitation,
} from '@/features/identity/invitation';
import styles from '@/features/identity/components/identity-screens.module.css';
import { readSession } from '@/server/session';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/** One namespace, five readers — named because `sonarjs/no-duplicate-string` is right about it. */
const MESSAGES = 'identity.invitation';

/**
 * S-03 — Accept invitation · CA · UC-15 · Focus
 *
 * The landing surface of the emailed link, reachable **signed out and signed in alike** —
 * `proxy.ts` has carried `invitation` in its unauthenticated segments since task 4, and both
 * entries are real: UC-15 step 2 has the invitee creating an account or using one they already
 * have.
 *
 * **Nothing is consumed on render.** The preview reads the invitation without spending it, and the
 * acceptance is an explicit POST from `AcceptInvitation` — the property task 19 built the
 * verification flow around, and the reason a mail scanner following this link cannot burn it.
 *
 * **The signed-out arm hands off to S-01 rather than hosting its own forms** (`design_spec.md`
 * S-03, amended 25 Aug 2026): the screen's four "controls" are one action and three routes, which
 * keeps this a Focus screen with a single primary action and keeps S-01 the one place a credential
 * is entered. The registration route carries the invitation, so the account it creates is already
 * verified and the invitee comes back able to accept — one email instead of two.
 *
 * The branch itself is `features/identity/invitation.ts`, deliberately: it reaches no API, so its
 * five arms — three of them error states — are a unit spec rather than five browser journeys.
 */
type Props = {
  params: LocaleParams & Promise<{ token: string }>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function AcceptInvitationPage({ params }: Props) {
  await activateRequestLocale(params);
  const { token } = await params;
  const t = await getTranslations(MESSAGES);

  // Both reads are independent — the session comes from a cookie this tier already holds, the
  // preview is an API round trip — so they run together rather than in sequence (async-parallel).
  const [preview, session] = await Promise.all([previewInvitationAction({ token }), readSession()]);

  const view = invitationView({
    preview: preview.status === API_OUTCOME.Ok ? preview.value : null,
    signedInAs: session?.account.email ?? null,
  });

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <InvitationBody view={view} token={token} />
    </>
  );
}

/**
 * The five surfaces, one per arm of the branch.
 *
 * A top-level component taking props rather than a closure inside the page — the shape
 * `rerender-no-inline-components` names. It does not strictly fire here (this is a Server
 * Component, and the function was called directly rather than rendered as a type, so React never
 * saw it remount), but the reason it was nested was to reach `view` and `token` without passing
 * them, which is exactly the habit the rule exists to break.
 */
function InvitationBody({ view, token }: { view: InvitationView; token: string }) {
  switch (view.kind) {
    case INVITATION_VIEW.ACCEPT:
      return (
        <div className={styles.stack}>
          <InvitationSummary invitation={view.invitation} />
          <AcceptInvitation token={token} invitation={view.invitation} />
        </div>
      );

    case INVITATION_VIEW.SIGN_IN_REQUIRED:
      return <SignedOut token={token} invitation={view.invitation} />;

    case INVITATION_VIEW.WRONG_ACCOUNT:
      return (
        <WrongAccount
          token={token}
          invitedEmail={view.invitation.invitedEmail}
          signedInAs={view.signedInAs}
        />
      );

    case INVITATION_VIEW.UNUSABLE:
      return <Unusable standing={view.standing} />;

    default:
      return <Unreachable />;
  }
}

/**
 * The hand-off (UX-38). Three routes and no forms — see the page header for why.
 *
 * The provider block streams behind the two password routes, for `async-suspense-boundaries`'
 * reason and S-01's: the provider list is an API round trip, and the routes that always work must
 * not wait on it. With the api unreachable it renders nothing and the two links stand alone.
 */
async function SignedOut({ token, invitation }: { token: string; invitation: UsableInvitation }) {
  const t = await getTranslations(MESSAGES);
  const links = invitationHandOff(token);

  return (
    <div className={styles.stack}>
      <InvitationSummary invitation={invitation} />
      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>{t('signedOutIntro')}</p>
        <Button asChild>
          <Link href={links.register}>{t('createAccount')}</Link>
        </Button>
        <p className={`t-body-sm ${styles.altAction}`}>
          {t.rich('haveAccount', {
            link: (chunks) => (
              <TextLink asChild>
                <Link href={links.signIn}>{chunks}</Link>
              </TextLink>
            ),
          })}
        </p>
      </Panel>
      <Suspense fallback={null}>
        <SocialProviders
          intent={SOCIAL_SIGN_IN_INTENT.REGISTER}
          returnTo={links.returnPath}
        />
      </Suspense>
    </div>
  );
}

/**
 * S-03's permission state (amended 25 Aug 2026) — a forwarded link, or the second mailbox a
 * bookkeeper actually uses.
 *
 * It names **both** addresses, because "this invitation is not for you" is unactionable without
 * saying which of the reader's mailboxes it is for. The primary way out signs out and returns
 * here, so the link survives the round trip; the second is stated as prose, since asking an
 * administrator for a different invitation is not something this screen can do.
 */
async function WrongAccount({
  token,
  invitedEmail,
  signedInAs,
}: {
  token: string;
  invitedEmail: string;
  signedInAs: string;
}) {
  const t = await getTranslations(MESSAGES);
  const links = invitationHandOff(token);

  return (
    <div className={styles.stack}>
      {/* `Callout.action` is required by design — NFR-79's "what now" — and here the action IS the
          way out rather than a link beside it, so the control lives in that slot. The sign-out
          action redirects to `/sign-in` on its own; the bound return path is what brings them back
          to THIS invitation, the same `?return=` contract the proxy writes on expiry. */}
      <Callout
        intent="warning"
        title={t('wrongAccountTitle')}
        action={
          <form action={signOutAction.bind(null, links.returnPath)}>
            <Button type="submit">{t('signInAsInvited', { invited: invitedEmail })}</Button>
          </form>
        }
      >
        {t('wrongAccountBody', { invited: invitedEmail, current: signedInAs })}
      </Callout>
      <p className={`t-body-sm ${styles.altAction}`}>{t('wrongAccountAlternative')}</p>
    </div>
  );
}

/**
 * The four recoverable states S-03 draws, told apart by the API's `standing` rather than by prose.
 *
 * One component and four message keys, not four components: the shape is identical — what happened,
 * why it cannot be undone here, and who can issue a new one — and the only thing that varies is the
 * sentence. Building four would have been the one-off-component defect UX-89 names, in the small.
 */
async function Unusable({ standing }: { standing: UnusableStanding }) {
  const t = await getTranslations(MESSAGES);

  return (
    <Callout
      intent="error"
      title={t(`standing.${standing}.title`)}
      action={
        <TextLink asChild>
          <Link href="/sign-in">{t('standingAction')}</Link>
        </TextLink>
      }
    >
      {t(`standing.${standing}.body`)}
    </Callout>
  );
}

/** Not a fact about the invitation, so it says so — the link is probably still good. */
async function Unreachable() {
  const t = await getTranslations('identity');

  return (
    <Callout intent="error" title={t('unreachable.title')} action={t('unreachable.action')}>
      {t('unreachable.body')}
    </Callout>
  );
}


