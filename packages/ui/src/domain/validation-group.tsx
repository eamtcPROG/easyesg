import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './validation-group.module.css';

/**
 * A module's findings in S-08 (task 42.2; UX-20) — the artboard's *B1 · BASIS FOR PREPARATION* with its count, then
 * each finding. **Grouped by module because that is where the work happens**, ordered as the list orders modules, so
 * the panel and the list can be read against each other; the order is the caller's.
 *
 * A list named by its heading, so a screen reader announces *B1 — Basis for preparation, list, 3 items*.
 */
export interface ValidationGroupProps {
  /** The module, by reference and name — the caller's words. */
  readonly heading: ReactNode;
  /** How many findings the group holds, in words. */
  readonly count: ReactNode;
  /** `ValidationFinding`s. */
  readonly children: ReactNode;
}

export function ValidationGroup({ heading, count, children }: ValidationGroupProps) {
  const headingId = useId();
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h3 id={headingId} className={styles.heading}>
          {heading}
        </h3>
        <span className={styles.count}>{count}</span>
      </div>
      <ul className={styles.findings} aria-labelledby={headingId}>
        {children}
      </ul>
    </section>
  );
}
