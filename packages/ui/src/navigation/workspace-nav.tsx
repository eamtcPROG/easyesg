import type { ReactNode } from 'react';
import { Anchor, type NavLinkComponent } from './nav-link';
import { ARIA_CURRENT } from './nav-link-vocabulary';
import styles from './workspace-nav.module.css';

/**
 * Workspace nav — §11.5's Navigation entry, and §4.2's **second** tier.
 *
 * Three tiers exist and there is no fourth: the global bar (organization switcher, notifications,
 * user menu), this — the workspace sections an Organization Administrator moves between — and the
 * wizard's module rail, which *replaces* this one rather than nesting inside it (UX-5). That is why
 * `(workspace)` and `(wizard)` are sibling route groups over one URL space.
 *
 * **Built with task 26.4** because S-16 was the first `(app)/(workspace)` screen and had no way to
 * be reached. Inlining a nav in the layout would have been the one-off UX-89 names — no state set,
 * no dark map, no expansion coverage — and the next workspace screen would have copied all four.
 *
 * **The API was rebuilt in task 105 (project owner), and the reason is what UX-89 means by
 * reusable.** It used to take `items: { key, link, current }` — a *rendered anchor* and a *resolved
 * boolean* per entry — so every consumer had to build JSX in a `.map` and compute its own active
 * state before it could render a nav. That is remapping, and it made the component a template
 * rather than a component: nothing was reused except the markup.
 *
 * It now takes **data plus two functions**. `items` is a typed list the caller already has, and the
 * component derives everything from it — which is what moved the accessibility guarantee inside.
 *
 * **`aria-current` belongs on the anchor, and that is why this component builds the anchor.**
 * It used to sit on the wrapping `<span>` here, on the argument that the caller owns the anchor and
 * asking every caller to remember an ARIA attribute is how one screen ends up without it. The first
 * half was true and the conclusion did not follow: a `<span>` is `role="generic"`, so a screen
 * reader moving link-to-link — which is how anyone navigates a nav — announces *"Entities, link"*
 * for the current section exactly as for every other. The underline reached sighted readers and
 * nothing reached anyone else, which is the programmatic half of §8.1's `current` state missing.
 * Building the anchor from `href` and `label` is what lets this be structural instead of a
 * convention each caller re-remembers, and it is what lets `workspace-nav.spec.tsx` assert it.
 *
 * **This package still holds no router and no strings.** `linkComponent` is injected — `apps/web`
 * passes `@/i18n/navigation`'s locale-aware `Link`, because a raw `next/link` drops the locale
 * prefix — and `label` arrives localized, exactly as the region's own `label` always has (UX-79).
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current**. There is no disabled
 * state — a section a reader may not enter is absent from the set rather than shown greyed, because
 * UX-1 requires a boundary to be explained by the screen that enforces it, not hinted at by chrome.
 */

/**
 * The minimum an item must carry. **Generic over it rather than fixed**, so a consumer whose own
 * section objects hold more — an icon, a permission, a badge count — passes them straight through
 * and `renderItem` receives them still typed. Narrowing to this shape is what forced the `.map`
 * the previous API required of everyone.
 */
export interface WorkspaceNavItem {
  /** Stable across renders and locales — the route, not the label. */
  readonly key: string;
  readonly href: string;
  /** Localized by the caller: this package owns no text (UX-79). */
  readonly label: string;
}

/** What `renderItem` is told, so a custom rendering can carry the same semantics. */
export interface WorkspaceNavItemState {
  readonly isActive: boolean;
  /**
   * Spread onto the interactive element. Carries `aria-current="page"` on the active item and
   * nothing otherwise — a bag rather than a boolean so a caller taking the `renderItem` path
   * cannot get the attribute's name or its value wrong, only forget the spread.
   */
  readonly linkProps: { readonly 'aria-current'?: 'page' };
}

export interface WorkspaceNavProps<TItem extends WorkspaceNavItem = WorkspaceNavItem> {
  /** Accessible name for the region, localized by the caller. */
  readonly label: string;
  readonly items: readonly TItem[];
  /**
   * Which item the reader is on. **A predicate rather than an active key**, because the matching
   * rule is the consumer's: this tier compares the pathname exactly, and a nav over nested routes
   * would need a prefix match. A component that guessed would be wrong for one of them.
   */
  readonly isActive: (item: TItem) => boolean;
  /**
   * Full control of an item's interior, for the cases the default cannot express — an icon beside
   * the label, a count after it. It replaces the anchor, so it also takes over `linkProps`; the
   * default path is the one that cannot be got wrong.
   */
  readonly renderItem?: (item: TItem, state: WorkspaceNavItemState) => ReactNode;
  /**
   * The app's own link. Optional: a consumer with no client-side router gets a plain anchor, which
   * is correct for a server-rendered nav and wrong only if the app needed its router — and a
   * missing locale prefix is visible on the first click rather than silent.
   */
  readonly linkComponent?: NavLinkComponent;
}

export function WorkspaceNav<TItem extends WorkspaceNavItem = WorkspaceNavItem>({
  label,
  items,
  isActive,
  renderItem,
  linkComponent,
}: WorkspaceNavProps<TItem>) {
  const Link = linkComponent ?? Anchor;

  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isActive(item);
          // Built once and handed to both paths, so the default rendering and a `renderItem` one
          // cannot disagree about what "current" means on the wire.
          const state: WorkspaceNavItemState = {
            isActive: active,
            linkProps: active ? { 'aria-current': ARIA_CURRENT.PAGE } : {},
          };

          return (
            <li key={item.key}>
              {/* The class stays on the wrapper — it is the underline's box, and the attribute it
                  used to carry now sits where a screen reader reads it. */}
              <span className={active ? styles.current : styles.item}>
                {renderItem ? (
                  renderItem(item, state)
                ) : (
                  <Link href={item.href} {...state.linkProps}>
                    {item.label}
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
