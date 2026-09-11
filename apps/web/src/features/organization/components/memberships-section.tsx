import { Callout, CALLOUT_INTENT, Panel, STATUS_TONE, StatusChip, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readMemberships } from '@/server/memberships';
import styles from './home.module.css';

/**
 * UC-16's *view memberships* half (FR-12) — task 30.5.
 *
 * **OQ-6 is why this list is on S-05 at all**: UC-16 is two behaviours, and this screen owns
 * *viewing* while the global tier owns *switching* (task 83). So the list states where the reader
 * belongs and what role they hold in each, and does not act — which is information, not a control
 * that cannot act.
 *
 * **S-35's wording is deliberately not repeated.** That screen exists for the sign-in-time failure
 * where nothing resolved and the reader has nowhere to be; here they are already inside an
 * organization and only this region did not load, so it says *that*. Task 25.4's recorded
 * obligation is discharged by the two states saying different things rather than by one being
 * silent.
 *
 * **It reads for itself rather than taking the list as a prop**, which is what makes it a sibling
 * of the heading rather than a child of a fetch: `readMemberships()` is React-`cache()`d, so the
 * heading, the global tier and this region share one HTTP call in the render pass. Threading the
 * array down from the page would have re-created the single `Promise.all` the split removed.
 *
 * **Not behind a Suspense boundary**, for the same reason: the promise it awaits is already in
 * flight for the chrome above it, so a boundary here would buy a streaming hole over a read that
 * costs nothing and cannot be the page's critical path.
 */
export async function MembershipsSection() {
  // Independent, so they do not queue (`async-parallel`).
  const [memberships, t, tRoles] = await Promise.all([
    readMemberships(),
    getTranslations('organization.home'),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <Panel>
      <h2 className={`t-heading-3 ${styles.regionHeading}`}>{t('memberships.heading')}</h2>

      {memberships === null ? (
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
