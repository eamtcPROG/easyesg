import type { ReactNode } from 'react';
import type { NavLinkComponent } from './nav-link';
import type { AriaCurrent } from './nav-link-vocabulary';

/**
 * The console navigation's data and props, read by `ConsoleNav`, `ConsoleDrawer` and the
 * `ConsoleNavSections` they draw.
 *
 * **A module below all three rather than a part of `console-nav.tsx`.** These lived there until
 * task 170 gave the column a part, and the part imported them back from the component that imports
 * it — a cycle `no-circular` refused from that commit until 1 Oct 2026, its own remedy being *"the
 * shared concept belongs in a third"*. A type is erased, so nothing broke at runtime; the dependency
 * still pointed from the part to its whole.
 *
 * Types only and directive-free, so no reader's `'use client'` can turn anything here into a client
 * reference.
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
