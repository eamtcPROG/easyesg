'use client';

import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
 * specimen's *Plan & billing* is Phase 7's and *Help centre* is 77.5, so neither is here and each
 * arrives with its screen; *Notifications* arrived with S-26 (task 50.2.1), as one of the caller's
 * `actions`.
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
  /**
   * The active organization and its control, at the head of the panel (task 83.2). **The organization
   * is the drawer's at this frame** — `design_spec.md` UX-2's amendment moves it out of the compact bar
   * — so it arrives here or it is unreachable, UX-76's reason again. Rendered, never introspected.
   */
  readonly organization?: ReactNode;
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
  organization,
}: ChromeDrawerProps<TItem>) {
  const Link = linkComponent ?? Anchor;
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={styles.trigger} aria-label={label}>
        <Menu aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.panel}
          /*
           * **Choosing a destination closes the panel**, and nothing else here would do it.
           * Radix closes on its own control, on Escape and on the overlay; a `Link` inside the
           * content is a client-side navigation, so the route changes underneath and nothing
           * unmounts — the panel stays open on top of the screen the reader just asked for, and
           * every tap costs a second one to dismiss it.
           *
           * **Delegated, and matching `button` as well as `a`**, because the entries that leave
           * this panel are not all links: sign-out is a submit button driven by a form action.
           * A rule written for anchors alone would leave the panel standing behind it.
           *
           * **A listener rather than wrapping each entry in `Dialog.Close asChild`**: that would
           * work for the sections this component builds and would introspect the caller's nodes in
           * `actions`, which is `account-menu.tsx`'s recorded hazard — a Server Component's
           * children arrive as a Flight reference and cloning one throws. Delegation reads the
           * event, never the element it was given.
           *
           * Re-tapping the section already open closes it too, which a route-change listener would
           * miss: the pathname does not change, and the reader still expects the panel to go.
           *
           * **Since task 83.2 a menu is opened from inside the panel** — the organization's switcher —
           * so two refinements, each the rule above read correctly. The control that **opens** a menu
           * leaves nothing, so `[aria-haspopup]` is passed over: closing on it would unmount the menu it
           * just opened. A row **chosen** in that menu leaves, whatever element Radix draws it as, so
           * `[role^="menuitem"]` counts as an entry — and it arrives here at all only because React
           * bubbles a portalled menu's events through the tree that rendered it, not the DOM.
           */
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest('[aria-haspopup]')) return;
            if (target.closest('a, button, [role^="menuitem"]')) setOpen(false);
          }}
        >
          {/* Required by Radix and hidden by design: the wordmark below already names the panel,
              so a visible heading would be its second copy. */}
          <Dialog.Title className={styles.name}>{label}</Dialog.Title>

          <div className={styles.head}>
            {brand}
            <Dialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>

          {organization ? <div className={styles.organization}>{organization}</div> : null}

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
