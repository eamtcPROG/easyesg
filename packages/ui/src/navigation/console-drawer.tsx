'use client';

import { Menu, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import type { ConsoleNavItem, ConsoleNavProps } from './console-nav-types';
import { ConsoleNavSections } from './console-nav-sections';
import styles from './console-drawer.module.css';

/**
 * The console navigation below `medium` (task 170; UX-77 as amended 24 Sep 2026, and again 25 Oct 2026, when the
 * sidebar's icon strip took the frames from `medium` to `wide`): a menu control in the console's bar that opens the
 * sidebar's headed sections in a panel across the frame on the navigation's own dark surface, arriving from the edge
 * the sidebar stands on.
 *
 * **`ChromeDrawer`'s decisions, for the console's anatomy.** That component is the tenant chrome's at
 * `compact`: flat destinations on the light surface, below 40rem. This one holds headed sections, on
 * `--consolenav-*`, below 40rem — the same Radix `Dialog` for the focus trap, Escape, the scroll lock
 * and a named modal, and the same delegated close: **choosing a destination closes the panel**, since
 * a client-side navigation changes the route underneath and unmounts nothing, and re-choosing the
 * current destination closes it too.
 *
 * **It takes data and builds its own anchors** through `ConsoleNavSections` — the rendering the column
 * uses, so the two cannot disagree about what is current. `brand` and `realm` are rendered, never introspected.
 *
 * **Sized for the reader it meets** (project owner, 25 Oct 2026): it is drawn only on a phone, where a reader taps, so
 * its rows are 44px with the tenant drawer's 15px type, where the sidebar keeps `Button`'s 40px — the sections read
 * the size from the panel, not from a prop. Its two controls are `Button`'s 40px square; the head is the brand, then
 * the close control at its far end (the owner's call on the sidebar's mock-up). The realm has a line of its own under
 * the head, since the band on a phone has no room for it.
 *

 * States (§8.1, the applicable subset): closed · open · rest · hover · focus · **current** ·
 * **empty** — with no destinations there is no control, as the column renders nothing.
 */
export interface ConsoleDrawerProps<TItem extends ConsoleNavItem = ConsoleNavItem>
  extends ConsoleNavProps<TItem> {
  /** Names the trigger and the panel, localized by the caller. */
  readonly openLabel: string;
  readonly closeLabel: string;
  /** What heads the panel before the close control — the wordmark. */
  readonly brand: ReactNode;
  /** The operator's realm, on a line of its own under the head. Localized by the caller. */
  readonly realm: ReactNode;
}

export function ConsoleDrawer<TItem extends ConsoleNavItem = ConsoleNavItem>({
  label,
  openLabel,
  closeLabel,
  brand,
  realm,
  sections,
  isActive,
  renderItem,
  linkComponent,
}: ConsoleDrawerProps<TItem>) {
  const [open, setOpen] = useState(false);

  if (sections.every((section) => section.items.length === 0)) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.trigger} aria-label={openLabel}>
        <Menu aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          // `ChromeDrawer`'s delegated close, for the reason it records: an anchor inside the panel
          // navigates without unmounting anything, so the panel would stand over the new screen.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          {/* Required by Radix and hidden by design: the brand beside the close control names it. */}
          <Dialog.Title className={styles.name}>{openLabel}</Dialog.Title>
          <div className={styles.head}>
            {brand}
            <Dialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className={styles.realm}>{realm}</div>
          <nav className={styles.sections} aria-label={label}>
            <ConsoleNavSections
              sections={sections}
              isActive={isActive}
              renderItem={renderItem}
              linkComponent={linkComponent}
            />
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
