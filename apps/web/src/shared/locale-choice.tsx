'use client';

import { LanguageSwitcher, SWITCHER_TONE, type SwitcherLocale } from '@easyesg/ui';
import type { Locale } from '@easyesg/i18n';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The language switcher, wired to this app's router — the one copy, shared by the two chromes
 * that carry the standalone control (task 74.1).
 *
 * **A Client Component for exactly one reason**, and it is `AccountCorner`'s: language is URL
 * state (`routing.ts`), so choosing one is a link to *this* address in another locale, and the
 * current address is knowable only in the browser. The query string rides along because a
 * verification token must survive the switch (UX-4: the address restores the state).
 *
 * **Every string arrives as a prop, and that is what let it be shared.** `IdentityHeaderActions`
 * resolved its own through `useTranslations('chrome')`, which works only where a layout has put
 * the `chrome` catalogue into a client provider — the `(identity)` layout does and the `(public)`
 * one does not, since §5.1b's public screens are the ones the framework may cache and shipping a
 * catalogue to them buys nothing (NFR-43). Taking labels as props removes the dependency instead
 * of duplicating the component around it.
 *
 * The third copy of this wiring is `AccountCorner`'s, and it stays a copy on purpose: the global
 * tier renders the choice as a Radix *submenu* of the account menu, whose second `DropdownMenu.Root`
 * would break the keyboard contract the first is carrying.
 */
export interface LocaleChoiceProps {
  /** Accessible name for the trigger, resolved by the caller on the server. */
  readonly label: string;
  /** The locale this page is being read in. */
  readonly locale: Locale;
  /** Every registered locale, each labelled with its own name for itself. */
  readonly locales: readonly SwitcherLocale<Locale>[];
}

export function LocaleChoice({ label, locale, locales }: LocaleChoiceProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;
  const current = locales.find((entry) => entry.code === locale) ?? locales[0];

  return (
    <LanguageSwitcher
      tone={SWITCHER_TONE.HEADER}
      label={label}
      current={current}
      locales={locales}
      renderItem={(entry) => (
        <Link href={target} locale={entry.code}>
          {entry.label}
        </Link>
      )}
    />
  );
}
