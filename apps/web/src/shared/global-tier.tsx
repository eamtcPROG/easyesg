import { BrandMark, GlobalBar } from '@easyesg/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { LOCALES } from '@easyesg/i18n';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readActiveMembership } from '@/server/memberships';
import { readSession } from '@/server/session';
import { AccountCorner } from './account-corner';

/**
 * §4.2's **global** tier, wired (task 30.1) — and the replacement for task 22's interim
 * `SessionStrip`, which named this task as its owner and is deleted with it.
 *
 * A Server Component, for the reason the strip was one: the session is read server-side (AD-9 — no
 * token or session detail may reach browser JavaScript), and so is the membership that names the
 * active organization. `proxy.ts` guarantees a cookie above this point but not a READABLE one — an
 * unsealable cookie renders nothing here, and the first data call's 401 is what surfaces it.
 *
 * **Every string is resolved here and handed down as a prop.** `AccountCorner` needs the browser
 * only for the current address (a language choice is a link to the same page in another locale), so
 * making it read the catalogue would put `chrome` into the client bundle for a component that needs
 * two hooks and no messages — the cost the `(workspace)` layout's namespace-scoped provider exists
 * to avoid (NFR-43).
 *
 * **The tier carries what renders, and nothing else** (29 Aug 2026, project owner). §4.2's global
 * tier is *organization switcher · notification centre · user menu · help*, and two of those four
 * have no screen yet: S-26 is task 50.2 and the help centre's placement across both chromes is
 * task 77.5's, which its row claims explicitly. A chrome entry leading to a blank page teaches the
 * reader that the product is broken rather than unfinished, which is `WorkspaceNavigation`'s rule
 * and the same judgement made again. The organization region is a name rather than a switcher for
 * a different reason, stated on `GlobalBar`: the switch is a session write and its route is
 * task 83's.
 */
export async function GlobalTier() {
  const [session, active, t, locale] = await Promise.all([
    readSession(),
    // Independent of the session read — both are needed and neither feeds the other, so awaiting
    // them in sequence would be a waterfall on the most-rendered path in the product.
    readActiveMembership(),
    getTranslations('chrome'),
    getLocale(),
  ]);
  if (!session) return null;

  return (
    <GlobalBar
      label={t('globalBar.label')}
      brand={
        <Link href={ROUTES.HOME} aria-label={t('brandHome')}>
          <BrandMark />
        </Link>
      }
      organization={
        active ? { label: t('globalBar.organization'), name: active.organizationName } : undefined
      }
      actions={
        <AccountCorner
          email={session.account.email}
          locale={locale}
          locales={LOCALES.map((code) => ({ code, label: t(`locales.${code}`) }))}
          labels={{
            account: t('accountMenu.label'),
            credentials: t('accountMenu.credentials'),
            signOut: t('accountMenu.signOut'),
            language: t('language'),
          }}
        />
      }
    />
  );
}
