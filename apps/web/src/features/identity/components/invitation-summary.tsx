import { getTranslations } from 'next-intl/server';
import type { UsableInvitation } from '../invitation';
import styles from './identity-screens.module.css';

/**
 * S-03's "Content and data shown", verbatim: **the inviting organization; the role being granted;
 * the invited email address, to which the invitation is bound.**
 *
 * A Server Component and a composition of nothing — three lines of text — so it ships no client
 * JavaScript and adds no component to the §11.5 inventory. UX-89 governs *components*, and a
 * screen-local arrangement of the app's own type roles is not one; the moment this needed a state
 * set or a variant it would be, and it would move to `packages/ui`.
 *
 * The address is shown because the invitation is bound to it (FR-11) — it is what tells someone
 * with two mailboxes which one to sign in with, and it is the fact the permission state below
 * refers back to.
 */
export async function InvitationSummary({ invitation }: { invitation: UsableInvitation }) {
  const t = await getTranslations('identity.invitation');

  return (
    <dl className={styles.summary}>
      <dt className="t-label">{t('summaryOrganization')}</dt>
      <dd className="t-body-strong">{invitation.organizationName}</dd>

      <dt className="t-label">{t('summaryRole')}</dt>
      <dd className="t-body">{t(`role.${invitation.role}`)}</dd>

      <dt className="t-label">{t('summaryAddress')}</dt>
      <dd className={`t-body ${styles.address}`}>{invitation.invitedEmail}</dd>
    </dl>
  );
}
