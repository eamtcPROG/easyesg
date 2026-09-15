'use client';

import { LanguageSwitcher, SWITCHER_TONE } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { useLocaleNames } from './use-locale-names';

/**
 * The language switcher, wired to this app's router — the one copy, shared by the two chromes
 * that carry the standalone control (task 74.1).
 *
 * **A Client Component for exactly one reason**, and it is `AccountCorner`'s: language is URL
 * state (`routing.ts`), so choosing one is a link to *this* address in another locale, and the
 * current address is knowable only in the browser. The query string rides along because a
 * verification token must survive the switch (UX-4: the address restores the state).
 *
 * **Its words are its own, and it takes no props** (task 158). From task 74.1 it took every string
 * as a prop, because `useTranslations('chrome')` then worked only where a layout had put `chrome`
 * into a scoped client provider — the `(identity)` layout did and the `(public)` one did not. Task
 * 99's single provider at the root ended that, so both chromes render `<LocaleChoice />` and the
 * catalogue reaches it the way it reaches every other Client Component.
 *
 * The third copy of this wiring is `AccountCorner`'s, and it stays a copy on purpose: the global
 * tier renders the choice as a Radix *submenu* of the account menu, whose second `DropdownMenu.Root`
 * would break the keyboard contract the first is carrying.
 */
export function LocaleChoice() {
  const t = useTranslations('chrome');
  const { locale, locales } = useLocaleNames();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;
  const current = locales.find((entry) => entry.code === locale) ?? locales[0];

  return (
    <LanguageSwitcher
      tone={SWITCHER_TONE.HEADER}
      label={t('language')}
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
