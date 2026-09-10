'use client';

import { Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Anchor, type NavLinkComponent } from './nav-link';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import type { WorkspaceNavItem } from './workspace-nav';
import styles from './chrome-drawer.module.css';

/**
 * §4.2's chrome at `compact` — the workspace tier as a drawer (task 108).
 *
 * **Drawn, not invented.** `EasyESG Workspace.dc.html` carries a specimen captioned *"390 ·
 * workspace tier as a drawer"*: the wordmark and a close control, then the workspace sections, then
 * a rule, then the global tier's own entries. UX-73 draws every screen at 1440 · 834 · 390, and
 * this is the third frame's answer to a band of five destinations that does not fit one.
 *
 * **It carries what renders**, which is `GlobalTier`'s standing rule rather than a new one: the
 * specimen's *Plan & billing* is Phase 7's, *Notifications* is task 50.2 and *Help centre* is
 * 77.5, so none of the three is here and each arrives with its screen.
 *
 * **It takes data and builds its own anchors**, which is what makes it safe rather than careful.
 * A drawer needs `'use client'` for its open state, and `account-menu.tsx` records the hazard that
 * follows: caller-supplied children wrapped in a Radix part's `asChild` arrive from a Server
 * Component as a Flight reference and take the route down. Task 106's seam removes the question —
 * `items` are `{ key, href, label }` and the router is injected, so nothing slotted crosses the
 * boundary. `brand` and `actions` are rendered rather than introspected, which is the safe half of
 * that rule.
 *
 * **Radix `Dialog` rather than a hand-rolled panel**, for the four things a drawer gets wrong on
 * its own: the focus trap, Escape, the scroll lock, and `aria-modal` with a name. The repo's
 * `consequence-dialogue.tsx` already establishes the part set.
 *
 * States (§8.1, the applicable subset): closed · open · rest · hover · focus · **current**. No
 * loading or error state — every destination is a link this component already holds, so there is
 * nothing here that can be pending or fail.
 */
export interface ChromeDrawerProps<TItem extends WorkspaceNavItem = WorkspaceNavItem> {
  /** Names the trigger and the panel, localized by the caller — this package owns no text. */
  readonly label: string;
  readonly closeLabel: string;
  /** Names the section list inside the panel, which is a `navigation` landmark of its own. */
  readonly sectionsLabel: string;
  /** The wordmark, at the head of the panel beside the close control. */
  readonly brand: ReactNode;
  /**
   * The tier's destinations. **Optional, because the public chrome has none yet**: the marketing
   * page's section nav is the list its own hamburger exists to hold and does not exist, so that
   * drawer carries only the block below. An empty list renders no `nav` at all rather than an
   * empty landmark for a screen reader to walk into.
   */
  readonly items?: readonly TItem[];
  readonly isActive?: (item: TItem) => boolean;
  readonly linkComponent?: NavLinkComponent;
  /**
   * The global tier's own entries at this frame — below the rule the specimen draws. The account
   * menu is absent from the compact bar, so whatever it carries has to arrive here or become
   * unreachable, which **UX-76** prohibits without an explicit statement.
   */
  readonly actions?: ReactNode;
}

export function ChromeDrawer<TItem extends WorkspaceNavItem = WorkspaceNavItem>({
  label,
  closeLabel,
  sectionsLabel,
  brand,
  items = [],
  isActive = () => false,
  linkComponent,
  actions,
}: ChromeDrawerProps<TItem>) {
  const Link = linkComponent ?? Anchor;

  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.trigger} aria-label={label}>
        <Menu aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel}>
          {/* Required by Radix and hidden by design: the wordmark below already names the panel,
              so a visible heading would be its second copy. */}
          <Dialog.Title className={styles.name}>{label}</Dialog.Title>

          <div className={styles.head}>
            {brand}
            <Dialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>

          {items.length > 0 ? (
            <nav aria-label={sectionsLabel}>
              <ul className={styles.list}>
                {items.map((item) => {
                  const active = isActive(item);
                  return (
                    <li key={item.key} className={active ? styles.current : undefined}>
                      <Link
                        href={item.href}
                        {...(active ? ({ 'aria-current': ARIA_CURRENT.PAGE } as const) : {})}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}

          {actions ? (
            <div className={items.length > 0 ? styles.actions : styles.actionsOnly}>{actions}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
