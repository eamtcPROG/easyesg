import type { AdminAccount } from '@easyesg/contracts';
import { BrandMark, ConsoleNav, GLOBAL_BAR_TONE, GlobalBar } from '@easyesg/ui';
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

  return (
    <div className="flex min-h-screen flex-col">
      <GlobalBar
        tone={GLOBAL_BAR_TONE.CONSOLE}
        label={t('bar')}
        brand={
          <span className="flex items-center gap-[var(--space-4)]">
            <Link to="/" aria-label={t('home')}>
              <BrandMark />
            </Link>
            <RealmChip className="border-[var(--consolebar-divider)] text-[var(--consolebar-text-muted)]" />
            <span aria-hidden="true" className="h-[var(--space-5)] w-px bg-[var(--consolebar-divider)]" />
            <span className="t-caption text-[var(--consolebar-text-muted)]">
              {t(`realm.${account.role}`)}
            </span>
          </span>
        }
        actions={<ConsoleAccount account={account} />}
      />
      <div className="flex flex-1">
        <ConsoleNav
          label={t('nav')}
          sections={sections}
          // A sub-screen marks its parent — the artboard's *Validation rules* lights *Factor sets &
          // rules* — so a destination is current at its own address and at any address beneath it.
          isActive={(item) => pathname === item.href || pathname.startsWith(`${item.href}/`)}
          linkComponent={ConsoleLink}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
