import { MEMBERSHIP_ROLE, type MembershipRole } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { FocusColumn, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { POST_SIGN_IN, targetLocale } from '@/features/identity/shared/tools/post-sign-in';
import { Link, redirect } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readMemberships } from '@/server/data/memberships';
import { destinationForHeldSession } from '@/server/session/post-sign-in';
import { CHOICE_MESSAGES } from './choice-messages';
import { OrganizationChoices } from './organization-choices';
import styles from './choice.module.css';

/**
 * S-37's one region (task 83.3; `design_spec.md` S-37): whether the screen applies at all, and the
 * reader's organizations to choose among when it does (`section-reads-parts-render`).
 *
 * **§4.3's branch decides, not this screen.** `destinationForHeldSession` is that branch over the session
 * this request arrived with, so a reader with an organization already resolved, one who belongs to
 * nothing, one still completing setup and one whose memberships could not be read are each sent where the
 * branch sends them — S-05, S-04, S-36, S-35 — and only *several, none chosen* renders here. Both reads
 * go through `readMemberships()`'s per-request cache, which the global tier above has already filled, so
 * the list below is the answer the branch judged and no second call is made.
 *
 * **Every string the list shows is resolved here** and handed down, the role names among them, so the
 * list's spec needs no catalogue and the client bundle carries no lookup. `organization.access.roles` stays a
 * literal, as at its other readers, until someone decides the namespace's feature-level home
 * (`shared-namespace-declared-once`).
 */
export async function ChooseOrganizationSection({
  searchParams,
  locale,
}: {
  readonly searchParams: Promise<{ return?: string }>;
  readonly locale: Locale;
}) {
  const [target, memberships, t, tRoles, { return: returnTo }] = await Promise.all([
    destinationForHeldSession(),
    readMemberships(),
    getTranslations(CHOICE_MESSAGES),
    getTranslations('organization.access.roles'),
    searchParams,
  ]);

  if (target.href !== POST_SIGN_IN.CHOOSE_ORGANIZATION) {
    redirect({ href: target.href, locale: targetLocale(target, locale) });
    return null;
  }
  // The branch answers S-37 only over a list it could read — this same cached list — so `null` is not a
  // state that reaches here; the check is for the type.
  if (memberships === null) return null;

  const roles = Object.fromEntries(
    Object.values(MEMBERSHIP_ROLE).map((role) => [role, tRoles(role)]),
  ) as Record<MembershipRole, string>;

  return (
    <FocusColumn>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <OrganizationChoices
        memberships={memberships}
        returnTo={returnTo}
        labels={{
          list: t('listLabel'),
          roles,
          unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
        }}
      />
      <p className={`t-body ${styles.create}`}>
        <TextLink asChild>
          <Link href={ROUTES.CREATE_ORGANIZATION}>{t('createAnother')}</Link>
        </TextLink>
      </p>
    </FocusColumn>
  );
}
