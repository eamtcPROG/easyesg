'use client';

import { ChevronDown, ChevronRight, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { GLOBAL_BAR_TONE, type GlobalBarTone } from './global-bar-vocabulary';
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
 * **The avatar carries initials since task 140, and the glyph is still what an account with no
 * name gets.** This docblock used to record the opposite — *"there is no name to reduce"* — under
 * OQ-16, which registration left open: the artboard drew `AR` beside *Ana Rusu* while UC-01
 * collected an address and a password and nothing else. OQ-16 is closed (12 Sep 2026) and UX-137
 * states the derivation, so the name is the visible text and the monogram is the avatar. **The
 * prediction that shipped with it held in both halves and neither is decorative:** initials cut
 * from an email address are an identity the product never captured, shown to the person it is
 * wrong about, so `monogram` is `null` rather than a letter wherever no name exists — and the
 * glyph, not a fallback initial, is what renders there.
 *
 * **The console's corner too, since task 67.1**, and the two differences are props rather than a second
 * menu. `tone` is the band the trigger stands on — `GlobalBar`'s own vocabulary, since this is part of
 * that bar's anatomy. And `language` is `null` where the surface has one locale: the console is
 * Romanian-only (architecture.md OQ-42), so a submenu offering one choice would be a control with
 * nothing to decide. Required-nullable rather than optional, on `Callout`'s `action={null}`
 * precedent: a surface says it has no language choice; it cannot forget one.
 *
 * States (§8.1 and §8.1-adjacent control states): rest · hover · focus · open · item highlighted ·
 * language item **current**, each in both of the avatar's two forms. There is no disabled state —
 * an item a reader may not use is absent from `items` rather than shown greyed, which is
 * `WorkspaceNav`'s rule and UX-1's reasoning.
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
  /** The signed-in address. Still the identity block's second line: two people may share a name
   *  and the address is what says *which* account this is. */
  readonly email: string;
  /**
   * UX-137's derived presentation string. Falls back to the address upstream, so this is never
   * empty and this component never decides what a name is — it is handed one.
   */
  readonly displayName: string;
  /**
   * UX-137's monogram, or `null` where the account has no name. **Not derived here**: the composite
   * collapses to the address when no name is set, and splitting that would show an initial cut from
   * an email — an identity the product never captured, shown to the person it is wrong about.
   */
  readonly monogram: string | null;
  readonly items: readonly AccountMenuItem[];
  /** The locale submenu, or `null` on a single-locale surface — see the docblock. */
  readonly language: AccountMenuLanguage<Code> | null;
  /** The band the trigger stands on. The tenant and public bands are `brand`, the console's `console`. */
  readonly tone?: GlobalBarTone;
}

export function AccountMenu<Code extends string = string>({
  label,
  email,
  displayName,
  monogram,
  items,
  language,
  tone = GLOBAL_BAR_TONE.BRAND,
}: AccountMenuProps<Code>) {
  return (
    // `modal={false}` because this is chrome, not a dialogue: the page behind it stays scrollable
    // and stays visible to a screen reader, which is right for a menu hanging off a header and
    // wrong for the overlay Radix's default gives it. It is also what makes the language submenu
    // usable — a modal root puts `pointer-events: none` on `body` and `auto` on its own layer,
    // and `SubContent` portals as a SIBLING of that layer, so it inherits the `none`. Measured:
    // the browser journey could not click a locale until this was set.
    <DropdownMenu.Root modal={false}>
      {/* **The accessible name carries the visible label AND the address, and the first half is
          WCAG rather than taste.** SC 2.5.3 *Label in Name* is Level A, so NFR-75's 2.2 AA includes
          it: the accessible name must contain the visible label text, or a speech-input user saying
          what they can see does not activate the control. This trigger showed the address and was
          named by it until task 140 made the NAME the visible text — at which point naming it by
          the address alone left *Ana Popescu* in no part of the accessible name, which is the
          criterion failing. `provider-button.tsx` states the same rule in one line.
          The address stays because it is the unique fact: two people may share a display name, and
          *which* account this opens is what a screen reader still needs. It is dropped only where
          the name IS the address — UX-137's no-name fallback — since naming it twice reads as a
          fault rather than as two facts, the identity block's rule one element down. */}
      <DropdownMenu.Trigger
        className={styles.trigger}
        data-tone={tone}
        aria-label={
          displayName === email ? `${label}: ${email}` : `${label}: ${displayName}, ${email}`
        }
      >
        <span aria-hidden="true" className={styles.avatar}>
          {monogram ? (
            <span className={styles.avatarMonogram}>{monogram}</span>
          ) : (
            <UserRound className={styles.avatarGlyph} />
          )}
        </span>
        <span className={styles.triggerName}>{displayName}</span>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={styles.menu}>
          {/* `Label`, not an `Item`: it is the identity block the artboard draws at the top, and a
              focusable row that does nothing is a keyboard stop with no destination. */}
          <DropdownMenu.Label className={styles.identity}>
            <span className={styles.identityName}>{displayName}</span>
            {/* Suppressed where the name IS the address, which is the no-name fallback: repeating
                one string on two lines reads as a rendering fault rather than as two facts. */}
            {displayName === email ? null : <span className={styles.identityEmail}>{email}</span>}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className={styles.separator} />
          {items.map((item) => (
            <DropdownMenu.Item key={item.key} asChild className={styles.item}>
              {item.node}
            </DropdownMenu.Item>
          ))}
          {language === null ? null : (
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
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
