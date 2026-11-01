import type { ReactNode } from 'react';
import { FocusColumn, FOCUS_MEASURE, type FocusMeasure } from './focus-column';
import styles from './focus-shell.module.css';

/**
 * Focus archetype (§4.6) — one task, no navigation: dark header with the brand and at most a
 * help route and the language switcher, a single centred column with one primary action, and
 * the legal footer. S-01…S-04, S-20 and S-25 are its instances; task 20 builds the first two.
 *
 * States (§8.1): the archetype itself is a frame and delegates state to its content — the
 * applicable per-screen subset is declared on each screen (S-01: loading-initial,
 * error-recoverable, error-permission; S-02: loading-initial, success, error-recoverable) and
 * carried by the form and Callout components inside the column.
 *
 * Slots, not imports: the header's links must be the app's locale-aware anchors, and this
 * package cannot know any router.
 *
 * **The column itself is `FocusColumn`** since task 30.2, which is what §4.6 actually lists as the
 * archetype's fixed element; the header and footer here are `(identity)`'s chrome, and a Focus
 * screen inside the authenticated shell takes the column alone — otherwise it inherits a second
 * `banner` under the global tier.
 */
export interface FocusShellProps {
  /** The brand corner — typically a home link wrapping `BrandMark`. */
  brand: ReactNode;
  /** Right side of the header: help route, language switcher. */
  actions?: ReactNode;
  /** Footer content: legal note and document links. */
  footer?: ReactNode;
  /** Passed through to `FocusColumn`; the identity screens are all `narrow`. */
  measure?: FocusMeasure;
  children: ReactNode;
}

export function FocusShell({
  brand,
  actions,
  footer,
  measure = FOCUS_MEASURE.NARROW,
  children,
}: FocusShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>{brand}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <FocusColumn measure={measure}>{children}</FocusColumn>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}
