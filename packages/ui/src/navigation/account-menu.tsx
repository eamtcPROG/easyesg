'use client';

import { ChevronDown, ChevronRight, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import type { SwitcherLocale } from './language-switcher';
import styles from './account-menu.module.css';

/**
 * The global tier's user menu (§4.2: *profile, language, sign out*), added with `GlobalBar` in
 * task 30.1.
 *
 * **Part of the Global bar's anatomy rather than a new §11.5 row.** §11.5's Navigation enumeration
 * lists the bar and the organization switcher; §4.2 enumerates what the bar contains, and the user
 * menu is one of the three things it names. So this is the bar's second file, not a twelfth
 * inventory entry — and it is emphatically not a one-off in a screen, which is what UX-89 forbids.
 *
 * **Language is a submenu, not a nested `LanguageSwitcher`.** §4.2 puts language *inside* this
 * menu, and a second `DropdownMenu.Root` opened from inside a `menuitem` breaks the keyboard
 * contract the first one is carrying — roving focus, Escape, focus return. Radix's `Sub` is the
 * primitive for the shape §4.2 describes. It takes `LanguageSwitcher`'s own `SwitcherLocale` and
 * `renderItem` contract rather than a second one, so the two surfaces cannot disagree about what a
 * locale choice is: the app supplies its locale-aware anchor and this styles a menu that knows no
 * router.
 *
 * **The avatar carries no initials, and that is OQ-16 rather than a shortcut.** The artboard draws
 * `AR` beside *Ana Rusu*; registration collects an address and a password and nothing else (UC-01),
 * so there is no name to reduce. Initials cut from an email address would be an identity the
 * product never captured, shown to the person it is wrong about. The glyph keeps the artboard's
 * anatomy and invents nothing; when OQ-16 closes, the name replaces the address here and the
 * monogram replaces the glyph.
 *
 * States (§8.1 and §8.1-adjacent control states): rest · hover · focus · open · item highlighted ·
 * language item **current**. There is no disabled state — an item a reader may not use is absent
 * from `items` rather than shown greyed, which is `WorkspaceNav`'s rule and UX-1's reasoning.
 */
export interface AccountMenuItem {
  /** Stable across renders and locales — the destination, not the label. */
  readonly key: string;
  /**
   * The caller's own element: a locale-aware anchor, or a submit button bound to a Server Action.
   * Wrapped in a `DropdownMenu.Item`, so it inherits the menu's keyboard and focus behaviour.
   */
  readonly node: ReactNode;
}

export interface AccountMenuLanguage<Code extends string = string> {
  /** Localized label for the submenu row — "Language", or its translation. */
  readonly label: string;
  readonly current: SwitcherLocale<Code>;
  readonly locales: readonly SwitcherLocale<Code>[];
  /** Returns the app's locale-aware anchor for one locale; wrapped in a menu item. */
  readonly renderItem: (locale: SwitcherLocale<Code>) => ReactNode;
}

export interface AccountMenuProps<Code extends string = string> {
  /** Accessible name for the trigger ("Your account"), localized by the app. */
  readonly label: string;
  /** The signed-in address — the identity block, and the trigger's visible text. */
  readonly email: string;
  readonly items: readonly AccountMenuItem[];
  readonly language: AccountMenuLanguage<Code>;
}

export function AccountMenu<Code extends string = string>({
  label,
  email,
  items,
  language,
}: AccountMenuProps<Code>) {
  return (
    // `modal={false}` because this is chrome, not a dialogue: the page behind it stays scrollable
    // and stays visible to a screen reader, which is right for a menu hanging off a header and
    // wrong for the overlay Radix's default gives it. It is also what makes the language submenu
    // usable — a modal root puts `pointer-events: none` on `body` and `auto` on its own layer,
    // and `SubContent` portals as a SIBLING of that layer, so it inherits the `none`. Measured:
    // the browser journey could not click a locale until this was set.
    <DropdownMenu.Root modal={false}>
      {/* The address is both the visible text and part of the accessible name: `Your account:
          ana@example.md` disambiguates the trigger for a screen reader without a second element,
          which is the pairing `LanguageSwitcher` already uses for the same reason. */}
      <DropdownMenu.Trigger className={styles.trigger} aria-label={`${label}: ${email}`}>
        <span aria-hidden="true" className={styles.avatar}>
          <UserRound className={styles.avatarGlyph} />
        </span>
        <span className={styles.triggerEmail}>{email}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={styles.menu}>
          {/* `Label`, not an `Item`: it is the identity block the artboard draws at the top, and a
              focusable row that does nothing is a keyboard stop with no destination. */}
          <DropdownMenu.Label className={styles.identity}>{email}</DropdownMenu.Label>
          <DropdownMenu.Separator className={styles.separator} />
          {items.map((item) => (
            <DropdownMenu.Item key={item.key} asChild className={styles.item}>
              {item.node}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={styles.item}>
              <span>{language.label}</span>
              <span className={styles.itemValue}>
                {language.current.label}
                <ChevronRight aria-hidden="true" className={styles.chevron} />
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={4} className={styles.menu}>
                {language.locales.map((locale) => (
                  <DropdownMenu.Item
                    key={locale.code}
                    asChild
                    className={styles.item}
                    data-current={locale.code === language.current.code || undefined}
                  >
                    {language.renderItem(locale)}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
