import type { ReactNode } from 'react';
import styles from './workspace-nav.module.css';

/**
 * Workspace nav — §11.5's Navigation entry, and §4.2's **second** tier.
 *
 * Three tiers exist and there is no fourth: the global bar (organization switcher, notifications,
 * user menu), this — the workspace sections an Organization Administrator moves between — and the
 * wizard's module rail, which *replaces* this one rather than nesting inside it (UX-5). That is why
 * `(workspace)` and `(wizard)` are sibling route groups over one URL space.
 *
 * **Built with task 26.4 rather than with the global tier**, because S-16 was the first
 * `(app)/(workspace)` screen and had no way to be reached. Inlining a nav in the layout would have
 * been the one-off UX-89 names — no state set, no dark map, no expansion coverage — and the next
 * workspace screen would have copied all four omissions. Task 30.1 builds the global tier above it
 * and extends the link set; nothing here changes when it does.
 *
 * **It takes items and renders anchors the caller supplies.** This package holds no router and no
 * strings (the standing rule), and `apps/web` must navigate through `@/i18n/navigation`'s
 * locale-aware `Link` — a raw `next/link` drops the locale prefix. So the caller passes its own
 * element per item and this contributes styling and the current-page semantics.
 *
 * States (§8.1, the applicable subset): rest · hover · focus · **current**. There is no disabled
 * state — a section a reader may not enter is absent from the set rather than shown greyed, because
 * UX-1 requires a boundary to be explained by the screen that enforces it, not hinted at by chrome.
 */
export interface WorkspaceNavItem {
  /** Stable across renders and locales — the route, not the label. */
  readonly key: string;
  /** The caller's own anchor, already carrying its href and its localized label. */
  readonly link: ReactNode;
  readonly current?: boolean;
}

export interface WorkspaceNavProps {
  /** Accessible name for the region, localized by the caller — "Workspace", or its translation. */
  readonly label: string;
  readonly items: readonly WorkspaceNavItem[];
}

export function WorkspaceNav({ label, items }: WorkspaceNavProps) {
  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key}>
            {/* `aria-current="page"` on the wrapper rather than the anchor: the caller owns the
                anchor, and asking every caller to remember the attribute is how one screen ends up
                without it. The class is redundant emphasis — the attribute is what carries it. */}
            <span
              className={item.current === true ? styles.current : styles.item}
              aria-current={item.current === true ? 'page' : undefined}
            >
              {item.link}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
