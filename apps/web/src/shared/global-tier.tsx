import { BrandMark, GlobalBar, SWITCHER_TONE } from '@easyesg/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { LOCALES } from '@easyesg/i18n';
import { OrganizationCorner } from '@/features/organization/switcher/components/organization-corner';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readMemberships } from '@/server/data/memberships';
import { readSession } from '@/server/session/session';
import { AccountCorner } from './account-corner';
import { WorkspaceDrawer } from './workspace-drawer';
import { WORKSPACE_SECTIONS } from './workspace-sections';
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
 * **Every string the account corner shows is resolved here and handed down as a prop.** `AccountCorner`
 * needs the browser only for the current address — a language choice is a link to the same page in another
 * locale — so it takes two hooks and no messages. The organization's control is the exception, and says why
 * in its own file: its note counts unsent answers, which only the browser knows.
 *
 * This used to be argued from payload — the catalogue reached the browser only where a scoped
 * provider named it, so a `useTranslations` here meant shipping `chrome`. **Task 99 ended that**:
 * one provider at the root serves every route group, so the argument above is what actually
 * survives, and it is about the client bundle rather than about the message payload.
 *
 * **The tier carries what renders, and nothing else** (29 Aug 2026, project owner). §4.2's global
 * tier is *organization switcher · notification centre · user menu · help*, and two of those four
 * have no screen yet: S-26 is task 50.2 and the help centre's placement across both chromes is
 * task 77.5's, which its row claims explicitly. A chrome entry leading to a blank page teaches the
 * reader that the product is broken rather than unfinished, which is `WorkspaceNavigation`'s rule
 * and the same judgement made again.
 *
 * **The organization is a switcher since task 83.2**, drawn twice: in the band from the medium frame up,
 * and in the compact drawer below it, where `design_spec.md` UX-2's amendment moves it. It is drawn only
 * when the session acts for an organization — the api's `active`, never a guess of this file's — so S-04,
 * S-35 and S-37 keep the band's empty state.
 */
export async function GlobalTier() {
  const [session, memberships, t, locale] = await Promise.all([
    readSession(),
    // Independent of the session read — both are needed and neither feeds the other, so awaiting
    // them in sequence would be a waterfall on the most-rendered path in the product.
    readMemberships(),
    getTranslations('chrome'),
    getLocale(),
  ]);
  if (!session) return null;

  const resolved = memberships?.some((membership) => membership.active) ? memberships : null;

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
          {/* The account corner at `medium` and `wide`; the drawer carries its entries at
              `compact`, where the artboards draw no avatar in the bar. One of the two is always
              `display: none`, so neither is offered twice. */}
          <span className={styles.wide}>
            <AccountCorner
              email={session.account.email}
              displayName={session.account.displayName}
              monogram={session.account.monogram}
              locale={locale}
              locales={LOCALES.map((code) => ({ code, label: t(`locales.${code}`) }))}
              labels={{
                account: t('accountMenu.label'),
                credentials: t('accountMenu.credentials'),
                signOut: t('accountMenu.signOut'),
                language: t('language'),
              }}
            />
          </span>
          <WorkspaceDrawer
            locale={locale}
            locales={LOCALES.map((code) => ({ code, label: t(`locales.${code}`) }))}
            labels={{
              menu: t('drawer.label'),
              close: t('drawer.close'),
              // The band's own accessible name, reused: the drawer IS the workspace tier at this
              // frame, so a second name for it would describe two navigations.
              sections: t('workspaceNav.label'),
              credentials: t('accountMenu.credentials'),
              signOut: t('accountMenu.signOut'),
              language: t('language'),
            }}
            sectionLabels={Object.fromEntries(
              WORKSPACE_SECTIONS.map((section) => [section.key, t(`workspaceNav.${section.key}`)]),
            )}
            organization={
              resolved ? (
                <OrganizationCorner memberships={resolved} tone={SWITCHER_TONE.DEFAULT} />
              ) : undefined
            }
          />
        </>
      }
    />
  );
}
