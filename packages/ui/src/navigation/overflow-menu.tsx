'use client';

import { Ellipsis } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useRef, type RefObject } from 'react';
import styles from './overflow-menu.module.css';

/**
 * Overflow menu — the Components sheet's own specimen, added to §11.5 on 24 Sep 2026 (task 170): a
 * **⋯** control that opens a row's own actions, which is how a console row carries them (§5.2's
 * preamble).
 *
 * **Items are data, never slotted nodes.** `account-menu.tsx` records the hazard a caller-supplied
 * node wrapped in Radix's `DropdownMenu.Item asChild` carries across a client boundary; a menu that
 * takes `{ key, label, onSelect }` builds its own items and has nothing to introspect. It also puts
 * the sheet's three rules where they cannot be forgotten:
 *
 * - **A destructive item is set apart by a rule** and drawn in the error colour — the caller marks it,
 *   this component places it last and draws the rule.
 * - **An item that opens a dialogue ends in an ellipsis** — the caller's words carry it, since the
 *   character belongs to the sentence (and to its translation), not to the control.
 * - **Every item exists somewhere visible too** — a rule about the screen, not this component: the
 *   record a row opens holds each of these actions, so the menu is a shortcut and never the only way.
 *
 * **Named for its row.** Every row's trigger is the same glyph, so a screen reader moving down a
 * column would hear *More actions* ten times; the caller passes a label that names the row.
 *
 * **Choosing an item hands focus to the trigger before the item runs** (19 Oct 2026). Radix returns focus to a
 * non-modal menu's trigger as it closes only where nothing outside was touched, and S-16's *Remind…*, which opens its
 * dialogue by changing the address, re-rendered the screen as the menu closed — focus fell to `body`, and the dialogue,
 * opening a render later, had no opener to hand focus back to (UX-113). With the trigger focused first, whatever an
 * item opens, now or a render later, finds the trigger as its opener (`useReturnFocus`).
 *
 * States (§8.1, the applicable subset): rest · hover · focus · open · item highlighted · item
 * disabled. **Empty renders nothing** — a trigger that opens an empty list is a control with no use.
 */
export interface OverflowMenuItem {
  /** Stable across renders — the action, not its words. */
  readonly key: string;
  /** Localized by the caller; ends in `…` where a dialogue follows. */
  readonly label: string;
  readonly onSelect: () => void;
  /** Set apart below a rule and drawn in the error colour. */
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

export interface OverflowMenuProps {
  /** The trigger's accessible name — name the row, e.g. "More actions for ana@easyesg.md". */
  readonly label: string;
  readonly items: readonly OverflowMenuItem[];
}

export function OverflowMenu({ label, items }: OverflowMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  if (items.length === 0) return null;

  const ordinary = items.filter((item) => item.destructive !== true);
  const destructive = items.filter((item) => item.destructive === true);

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger ref={trigger} className={styles.trigger} aria-label={label}>
        <Ellipsis aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
          {ordinary.map((item) => (
            <MenuItem key={item.key} item={item} trigger={trigger} />
          ))}
          {ordinary.length > 0 && destructive.length > 0 ? (
            <DropdownMenu.Separator className={styles.separator} />
          ) : null}
          {destructive.map((item) => (
            <MenuItem key={item.key} item={item} trigger={trigger} />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  item,
  trigger,
}: {
  readonly item: OverflowMenuItem;
  readonly trigger: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DropdownMenu.Item
      className={item.destructive === true ? `${styles.item} ${styles.destructive}` : styles.item}
      disabled={item.disabled}
      onSelect={() => {
        trigger.current?.focus();
        item.onSelect();
      }}
    >
      {item.label}
    </DropdownMenu.Item>
  );
}
