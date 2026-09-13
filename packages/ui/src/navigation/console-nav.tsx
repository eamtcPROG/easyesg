import { useId, type ReactNode } from 'react';
import { Anchor, type NavLinkComponent } from './nav-link';
import { ARIA_CURRENT, type AriaCurrent } from './nav-link-vocabulary';
import styles from './console-nav.module.css';

/**
 * Console nav — §11.5's Navigation entry for the administrative console (task 67.1), drawn on every
 * signed-in frame of `EasyESG Admin Console Screens.dc.html`: a dark column of headed sections, the
 * current destination marked by a left rule, a surface and a weight.
 *
 * **A row of its own rather than a `WorkspaceNav` variant**, because the anatomy differs — headed
 * sections, a vertical list, and a count beside a destination that the artboard fills with
 * exception-queue badges — which is UX-89's test rather than a skin. It keeps `WorkspaceNav`'s API on
 * purpose (task 105's lesson): items are data, `isActive` is the consumer's predicate, the link is
 * injected, and **this component builds the anchor**, so `aria-current` is structural rather than a
 * convention each caller re-remembers.
 *
 * **Each list is named by its heading**, through `aria-labelledby`, so a screen reader moving by list
 * hears *Platform* or *Billing* rather than an anonymous run of links.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current** · **empty**. A section with
 * no destinations is not drawn, and a navigation with none renders nothing — the console's state until
 * its first screen ships (`design_spec.md` §5.2: the chrome carries what renders). There is no
 * disabled state: a destination an operator may not enter is absent, as `WorkspaceNav`'s are (UX-1).
 */
export interface ConsoleNavItem {
  /** Stable across renders — the route, not the label. */
  readonly key: string;
  readonly href: string;
  /** Localized by the caller: this package owns no text (UX-79). */
  readonly label: string;
}

export interface ConsoleNavSection<TItem extends ConsoleNavItem = ConsoleNavItem> {
  readonly key: string;
  /** Localized by the caller, and the accessible name of the section's list. */
  readonly heading: string;
  readonly items: readonly TItem[];
}

/** What `renderItem` is told, so a custom rendering — a badge beside the label — keeps the semantics. */
export interface ConsoleNavItemState {
  readonly isActive: boolean;
  /** Spread onto the interactive element: `aria-current="page"` on the active item, nothing otherwise. */
  readonly linkProps: { readonly 'aria-current'?: AriaCurrent };
}

export interface ConsoleNavProps<TItem extends ConsoleNavItem = ConsoleNavItem> {
  /** Accessible name for the navigation region, localized by the caller. */
  readonly label: string;
  readonly sections: readonly ConsoleNavSection<TItem>[];
  /** Which destination the operator is on — the consumer's rule, since only it knows its routes. */
  readonly isActive: (item: TItem) => boolean;
  /** Full control of an item's interior — the count slot the artboard draws. Replaces the anchor. */
  readonly renderItem?: (item: TItem, state: ConsoleNavItemState) => ReactNode;
  /** The app's own link. Optional: a consumer with no router gets a plain anchor. */
  readonly linkComponent?: NavLinkComponent;
}

export function ConsoleNav<TItem extends ConsoleNavItem = ConsoleNavItem>({
  label,
  sections,
  isActive,
  renderItem,
  linkComponent,
}: ConsoleNavProps<TItem>) {
  const id = useId();
  const Link = linkComponent ?? Anchor;
  const populated = sections.filter((section) => section.items.length > 0);

  if (populated.length === 0) return null;

  return (
    <nav className={styles.nav} aria-label={label}>
      {populated.map((section) => {
        const headingId = `${id}-${section.key}`;

        return (
          <div key={section.key} className={styles.section}>
            <p id={headingId} className={styles.heading}>
              {section.heading}
            </p>
            <ul className={styles.list} aria-labelledby={headingId}>
              {section.items.map((item) => {
                const active = isActive(item);
                // Built once and handed to both paths, so the default rendering and a `renderItem`
                // one cannot disagree about what "current" means on the wire.
                const state: ConsoleNavItemState = {
                  isActive: active,
                  linkProps: active ? { 'aria-current': ARIA_CURRENT.PAGE } : {},
                };

                return (
                  <li key={item.key} className={active ? styles.current : styles.item}>
                    {renderItem ? (
                      renderItem(item, state)
                    ) : (
                      <Link href={item.href} {...state.linkProps}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
