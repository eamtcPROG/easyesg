import { getTranslations } from 'next-intl/server';
import { readActiveMembership } from '@/server/memberships';
import styles from './home.module.css';

/**
 * S-05's header: the organization the reader is acting for, and the role they hold in it.
 *
 * **The heading names the organization, not the reader** (task 30.5, unchanged): the artboard's
 * *"Good afternoon, Ana"* needs a display name registration does not collect (OQ-16, open) and a
 * time of day this Server Component cannot know for the reader.
 *
 * **The active membership comes from `readActiveMembership()` and is never re-derived here.** The
 * page used to compute `memberships?.find((m) => m.active)` inline *while also* awaiting
 * `readActiveMembership()` in the same `Promise.all` — one value, two spellings, and the inline one
 * is exactly what `server/memberships.ts` refuses: *"a second answer derived here … would be right
 * until the day someone holds two, and wrong invisibly."* Splitting the region out is what made the
 * duplicate visible.
 *
 * **Not behind a Suspense boundary.** This is the screen's layout anchor and sits above the fold, so
 * a fallback that resolved into a different-length organization name would shift everything under
 * it; and the read costs nothing here, because it is React-`cache()`d and the global tier in the
 * `(app)` layout is awaiting the same promise in the same pass.
 */
export async function OrganizationHeading() {
  const [active, t, tRoles] = await Promise.all([
    readActiveMembership(),
    getTranslations('organization.home'),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <header>
      <h1 className={`t-heading-1 ${styles.title}`}>
        {active ? active.organizationName : t('title')}
      </h1>
      <p className={`t-body ${styles.lede}`}>{active ? tRoles(active.role) : t('lede')}</p>
    </header>
  );
}
