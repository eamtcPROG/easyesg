'use client';

import { Check, ChevronDown } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { Spinner } from '../primitives/spinner';
import { SWITCHER_TONE, type SwitcherTone } from './language-switcher-vocabulary';
import styles from './organization-switcher.module.css';

/**
 * Organization switcher — §11.5's Navigation entry beside the Global bar (task 83.2; UC-16, FR-12).
 *
 * **The band's organization plate, made the control it was always drawn as.** Task 30.1 shipped a
 * plate with no caret because the session write had no route; task 83.1 gave it one. The anatomy is
 * `EasyESG Components.dc.html`'s *Switcher · open* specimen: the trigger names the active organization,
 * and the menu it opens carries an optional note, one row per organization — its name over the role
 * held there — and a closing entry to create another.
 *
 * **Radio items, so "current" is a state a screen reader hears** — `menuitemradio` with `aria-checked`,
 * and a check drawn beside it, never colour alone (UX-102). **Choosing the current row changes nothing,
 * and this component is what makes that so**: Radix's `onValueChange` fires for a click on the checked
 * row as well — measured by this component's spec, which assumed otherwise on its first run — so the
 * key is compared before it is handed over, rather than a pointless write left to the app to refuse.
 *
 * **It decides nothing about what a choice does.** Unsent work, the confirmation that guards it, the
 * write and where the reader lands are the app's (UX-3, UX-37); this hands the key over, draws the
 * note it is given, and holds every row while `pendingKey` names a switch on its way.
 *
 * **`tone` is `LanguageSwitcher`'s word**, because the two surfaces are the same two: `header` on the
 * dark band, `default` on a light one — the compact drawer's panel, where UX-2's amendment puts it. The name
 * truncates on the band, which is one row, and wraps in the drawer, where the amendment names it in full.
 *
 * **`closingItem` is the caller's own anchor, wrapped in a menu item** — `AccountMenu`'s seam, and its
 * obligation with it: a slotted node from a Server Component arrives as a Flight reference and cannot be
 * cloned, so the caller must be a Client Component.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · open · row highlighted · row current ·
 * **pending** (a switch on its way: the trigger busy, every row held) · **with a note**.
 */
export interface OrganizationSwitcherItem {
  /** The organization's id — what `onChoose` hands back. */
  readonly key: string;
  readonly name: string;
  /** The role held there, in the reader's language (task 30.1: the role alone, no counts). */
  readonly detail: string;
}

export interface OrganizationSwitcherProps {
  /** Names the region for a screen reader — "Active organization", or its translation. */
  readonly label: string;
  readonly organizations: readonly OrganizationSwitcherItem[];
  /** The organization this session acts for. */
  readonly currentKey: string;
  readonly onChoose: (key: string) => void;
  /** The organization a switch is on its way to, or `null`; every row waits while one is. */
  readonly pendingKey?: string | null;
  /** A sentence above the rows — unsent answers, in the app's words — or `null` for none. */
  readonly note?: string | null;
  /** The closing entry: the app's own anchor to create another organization. */
  readonly closingItem: ReactNode;
  readonly tone?: SwitcherTone;
}

export function OrganizationSwitcher({
  label,
  organizations,
  currentKey,
  onChoose,
  pendingKey = null,
  note = null,
  closingItem,
  tone = SWITCHER_TONE.DEFAULT,
}: OrganizationSwitcherProps) {
  const current = organizations.find((organization) => organization.key === currentKey);
  const pending = pendingKey !== null;

  return (
    // `modal={false}` for `AccountMenu`'s reason: chrome, not a dialogue.
    <DropdownMenu.Root modal={false}>
      {/* SC 2.5.3: the visible name is inside the accessible one, and the label says what it is. */}
      <DropdownMenu.Trigger
        className={styles.trigger}
        data-tone={tone}
        aria-label={`${label}: ${current?.name ?? ''}`}
        aria-busy={pending || undefined}
      >
        <span className={styles.name}>{current?.name}</span>
        {pending ? <Spinner /> : <ChevronDown aria-hidden="true" className={styles.chevron} />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={styles.menu}>
          {note === null ? null : (
            <>
              {/* A `Label`, not an `Item`: a focusable row that does nothing is a stop with no destination. */}
              <DropdownMenu.Label className={styles.note}>{note}</DropdownMenu.Label>
              <DropdownMenu.Separator className={styles.separator} />
            </>
          )}
          <DropdownMenu.RadioGroup
            value={currentKey}
            onValueChange={(key) => {
              if (key !== currentKey) onChoose(key);
            }}
          >
            {organizations.map((organization) => (
              <DropdownMenu.RadioItem
                key={organization.key}
                value={organization.key}
                className={styles.item}
                disabled={pending}
              >
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{organization.name}</span>
                  <span className={styles.itemDetail}>{organization.detail}</span>
                </span>
                <DropdownMenu.ItemIndicator className={styles.indicator}>
                  <Check aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className={styles.separator} />
          <DropdownMenu.Item asChild className={styles.item}>
            {closingItem}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
