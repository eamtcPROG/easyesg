import type { AdminAccount } from '@easyesg/contracts';
import { BrandMark, ConsoleDrawer, ConsoleNav, GLOBAL_BAR_TONE, GlobalBar } from '@easyesg/ui';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { CONSOLE_DESTINATIONS, consoleSectionsFor } from '../../tools/console-sections';
import { RealmChip } from '../shared/realm-chip';
import { ConsoleAccount } from './console-account';
import { ConsoleLink } from './console-link';

/**
 * The console chrome (task 67.1; `design_spec.md` §5.2), as `EasyESG Admin Console Screens.dc.html`
 * draws it on every signed-in frame: the Global bar in the console's tone above a row of the side
 * navigation and the screen.
 *
 * **Every part is the inventory's** (UX-89) — `GlobalBar` with `GLOBAL_BAR_TONE.CONSOLE`,
 * `ConsoleNav`, `AccountMenu` through `ConsoleAccount` — and what this file adds is the composition:
 * which realm the bar names, which sections the navigation holds, and the landmark the screen renders
 * into.
 *
 * **The bar names the realm, not a person.** The artboard draws *"Platform administrator · Ana
 * Ceban"*; an administrator account holds an address and a role, so the bar says the role and the
 * account menu the address.
 *
 * **The navigation carries what renders, and only the operator's own realm** — both rules are
 * `console-sections.ts`'s, with their reasons. Today that is nothing for anyone, so `ConsoleNav`
 * renders nothing and the screen takes the full width.
 *
 * **No organization selector, and there must never be one** (D-5, `apps/admin/CLAUDE.md`).
 *
 * **Below `wide` the navigation is a drawer** (task 170; UX-77 as amended): `ConsoleNav` is not drawn
 * there and `ConsoleDrawer`'s menu control leads the bar, opening the same sections. At `compact` the bar
 * keeps the wordmark and the account corner, and the realm's name moves into the drawer's head — so it
 * is one tap away rather than squeezed out of a 390px band, which is UX-76's rule for anything a narrow
 * frame cannot hold.
 */
export function ConsoleChrome({
  account,
  children,
}: {
  readonly account: AdminAccount;
  readonly children: ReactNode;
}) {
  const t = useTranslations('realm.chrome');
  const pathname = useLocation({ select: (location) => location.pathname });

  const sections = consoleSectionsFor({ role: account.role, destinations: CONSOLE_DESTINATIONS }).map(
    (section) => ({
      key: section.key,
      heading: t(`sections.${section.key}`),
      items: section.items.map((item) => ({ key: item.href, href: item.href, label: t(item.label) })),
    }),
  );
  // A sub-screen marks its parent — the artboard's *Validation rules* lights *Factor sets & rules* — so
  // a destination is current at its own address and at any address beneath it.
  const isActive = (item: { readonly href: string }) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const realm = t(`realm.${account.role}`);

  return (
    <div className="flex min-h-screen flex-col">
      <GlobalBar
        tone={GLOBAL_BAR_TONE.CONSOLE}
        label={t('bar')}
        brand={
          <span className="flex min-w-0 items-center gap-[var(--space-4)]">
            <ConsoleDrawer
              label={t('nav')}
              openLabel={t('menuOpen')}
              closeLabel={t('menuClose')}
              brand={
                <span className="flex min-w-0 items-center gap-[var(--space-4)]">
                  <BrandMark />
                  <span className="t-caption truncate text-[var(--consolebar-text-muted)]">{realm}</span>
                </span>
              }
              sections={sections}
              isActive={isActive}
              linkComponent={ConsoleLink}
            />
            <Link to="/" aria-label={t('home')}>
              <BrandMark />
            </Link>
            <span className="hidden items-center gap-[var(--space-4)] sm:flex">
              <RealmChip className="border-[var(--consolebar-divider)] text-[var(--consolebar-text-muted)]" />
              <span aria-hidden="true" className="h-[var(--space-5)] w-px bg-[var(--consolebar-divider)]" />
              <span className="t-caption text-[var(--consolebar-text-muted)]">{realm}</span>
            </span>
          </span>
        }
        actions={<ConsoleAccount account={account} />}
      />
      <div className="flex flex-1">
        <ConsoleNav label={t('nav')} sections={sections} isActive={isActive} linkComponent={ConsoleLink} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
