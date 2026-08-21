'use client';

import { ChevronDown } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import styles from './language-switcher.module.css';

/**
 * Language switcher — IMPLEMENTATION_PLAN Phase 2 places it here because identity is the first
 * surface that has one; the prototype draws it on every identity header.
 *
 * Language is deliberately URL state (routing.ts): every locale variant of a page is a
 * shareable address, so switching is **navigation**, not a preference mutation. That is why
 * items are rendered through `renderItem` — the app supplies its locale-aware `Link`, and this
 * package styles a menu without knowing any router. Radix DropdownMenu carries the keyboard
 * and focus behaviour (arrow keys, Escape, focus return) that a hand-rolled menu forgets.
 *
 * Each item's label is the language's own name in that language (RO "Română", RU "Русский") —
 * a reader who cannot read the current language must still find theirs, which is also why the
 * trigger names the current language rather than an icon alone (UX-102).
 */
export interface SwitcherLocale<Code extends string = string> {
  code: Code;
  /** The language's own name for itself, e.g. "Română". */
  label: string;
}

/**
 * The two surfaces this switcher sits on, as an `as const` object with the union derived
 * (CLAUDE.md, "Conventions"). Deriving changes no caller — `tone="header"` still compiles.
 */
export const SWITCHER_TONE = { DEFAULT: 'default', HEADER: 'header' } as const;

export type SwitcherTone = (typeof SWITCHER_TONE)[keyof typeof SWITCHER_TONE];

export interface LanguageSwitcherProps<Code extends string = string> {
  /** Accessible name for the trigger ("Language"), localized by the app. */
  label: string;
  current: SwitcherLocale<Code>;
  locales: readonly SwitcherLocale<Code>[];
  /** Returns the app's locale-aware anchor for one locale; wrapped in a menu item. */
  renderItem: (locale: SwitcherLocale<Code>) => ReactNode;
  /** `header` renders on the dark Focus header; `default` on light surfaces. */
  tone?: SwitcherTone;
}

export function LanguageSwitcher<Code extends string = string>({
  label,
  current,
  locales,
  renderItem,
  tone = SWITCHER_TONE.DEFAULT,
}: LanguageSwitcherProps<Code>) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={[styles.trigger, tone === SWITCHER_TONE.HEADER ? styles.header : ''].join(' ')}
        aria-label={`${label}: ${current.label}`}
      >
        {current.label}
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={styles.menu}>
          {locales.map((locale) => (
            <DropdownMenu.Item
              key={locale.code}
              asChild
              className={styles.item}
              data-current={locale.code === current.code || undefined}
            >
              {renderItem(locale)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
