import type { ReactNode } from 'react';
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
 * package cannot know any router. The column is `min(440px, 100%)` — the prototype's fixed
 * measure, fluid below it, so the +40% expansion harness stretches text down, never sideways.
 */
export interface FocusShellProps {
  /** The brand corner — typically a home link wrapping `BrandMark`. */
  brand: ReactNode;
  /** Right side of the header: help route, language switcher. */
  actions?: ReactNode;
  /** Footer content: legal note and document links. */
  footer?: ReactNode;
  children: ReactNode;
}

export function FocusShell({ brand, actions, footer, children }: FocusShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>{brand}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <main className={styles.main}>
        <div className={styles.column}>{children}</div>
      </main>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  );
}
