import { BrandMark, GlobalBar, SWITCHER_TONE } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { NotificationsPanel } from '@/features/notifications/panel/components/section/notifications-panel';
import { OrganizationCorner } from '@/features/organization/switcher/components/organization-corner';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readMemberships } from '@/server/data/memberships';
import { readSession } from '@/server/session/session';
import { AccountCorner } from './account-corner';
import { WorkspaceDrawer } from './workspace-drawer';
import styles from './global-tier.module.css';

/**
 * §4.2's **global** tier, wired (task 30.1) — and the replacement for task 22's interim
 * `SessionStrip`, which named this task as its owner and is deleted with it.
 *
 * A Server Component, for the reason the strip was one: the session is read server-side (AD-9 — no
 * token or session detail may reach browser JavaScript), and so are the memberships that name the
 * active organization. `proxy.ts` guarantees a cookie above this point but not a READABLE one — an
 * unsealable cookie renders nothing here, and the first data call's 401 is what surfaces it.
 *
 * **What it hands down is what only the server holds** — the session's account, and the memberships.
 * The band's own words are resolved here; each control below it is a Client Component that reads
 * `chrome` itself through `useTranslations` (task 158).
 *
 * **This used to hand every string down as a prop**, argued first from payload — the catalogue reached
 * the browser only where a scoped provider named it, so a `useTranslations` below meant shipping
 * `chrome` — and, once task 99's single provider ended that, from the client bundle. Neither held by
 * then: `OrganizationCorner`, in this same band, already called `useTranslations`, so the translator
 * was in the page regardless. `architecture.md` §12.5.6's task-158 row carries the measurement.
 *
 * **The tier carries what renders, and nothing else** (29 Aug 2026, project owner). §4.2's global
 * tier is *organization switcher · notification centre · user menu · help*; the help centre's
 * placement across both chromes is task 77.5's, which its row claims explicitly. A chrome entry
 * leading to a blank page teaches the reader that the product is broken rather than unfinished,
 * which is `WorkspaceNavigation`'s rule and the same judgement made again.
 *
 * **The notification centre's bell since task 50.2.1, and the panel it opens since 50.2.2**, at every frame
 * — UX-62's count *visible from any screen*, which the three workspace artboards draw in the compact bar too —
 * and only when the session acts for an organization: the centre is the active organization's (UC-165), so
 * S-04, S-35 and S-37 have no centre to lead to, exactly as they have no organization to name.
 *
 * **The organization is a switcher since task 83.2**, drawn twice: in the band from the medium frame up,
 * and in the compact drawer below it, where `design_spec.md` UX-2's amendment moves it. It is drawn only
 * when the session acts for an organization — the api's `active`, never a guess of this file's — so S-04,
 * S-35 and S-37 keep the band's empty state.
 */
export async function GlobalTier() {
  const [session, memberships, t] = await Promise.all([
    readSession(),
    // Independent of the session read — both are needed and neither feeds the other, so awaiting
    // them in sequence would be a waterfall on the most-rendered path in the product.
    readMemberships(),
    getTranslations('chrome'),
  ]);
  if (!session) return null;

  const active = memberships?.find((membership) => membership.active);
  const resolved = active ? memberships : null;

  return (
    <GlobalBar
      label={t('globalBar.label')}
      brand={
        <Link href={ROUTES.HOME} aria-label={t('brandHome')}>
          <BrandMark />
        </Link>
      }
      organization={
        resolved ? <OrganizationCorner memberships={resolved} tone={SWITCHER_TONE.HEADER} /> : undefined
      }
      actions={
        <>
          {/* The bell at every frame — the compact bar draws it beside the drawer's trigger, as the
              wider ones draw it beside the avatar. */}
          {active ? <NotificationsPanel organizationId={active.organizationId} /> : null}
          {/* The account corner at `medium` and `wide`; the drawer carries its entries at
              `compact`, where the artboards draw no avatar in the bar. One of the two is always
              `display: none`, so neither is offered twice. */}
          <span className={styles.wide}>
            <AccountCorner
              email={session.account.email}
              displayName={session.account.displayName}
              monogram={session.account.monogram}
            />
          </span>
          <WorkspaceDrawer
            organization={
              active && resolved
                ? {
                    switcher: <OrganizationCorner memberships={resolved} tone={SWITCHER_TONE.DEFAULT} />,
                    id: active.organizationId,
                  }
                : undefined
            }
          />
        </>
      }
    />
  );
}
