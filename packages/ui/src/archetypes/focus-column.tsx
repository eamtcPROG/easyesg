import type { ReactNode } from 'react';
import styles from './focus-column.module.css';

/**
 * The Focus archetype's own fixed element (§4.6): **a single centred column**, extracted from
 * `FocusShell` in task 30.2.
 *
 * §4.6 lists Focus's fixed elements as *"single column, centred, one primary action"* — a header
 * and a footer are not among them. `FocusShell` grew both because `(identity)` is where the
 * archetype first landed and there is no other chrome on a signed-out screen. S-04 is the first
 * Focus screen **inside** the authenticated shell, and there the global tier is already the page's
 * chrome, so reusing `FocusShell` would put a second `banner` on the page — the exact landmark
 * duplication task 30.1 had to unpick between `RecordShell` and the global bar.
 *
 * So the shell composes this rather than the other way round, and the measure is defined once for
 * both. It renders the `<main>` landmark, which is the other half of that lesson: a Focus screen
 * under the global tier has chrome and needs something to skip *to*.
 *
 * States (§8.1): none of its own. The archetype is a frame and delegates every state to its
 * content — the applicable per-screen subset is declared on each screen and carried by the form,
 * `Callout` and `EmptyState` inside the column.
 */
export const FOCUS_MEASURE = {
  /** 440px — the identity screens' column (S-01, S-02, S-03), two or three fields wide. */
  NARROW: 'narrow',
  /** 560px — S-04's, from the Workspace prototype: four fields, help text under each. */
  WIDE: 'wide',
} as const;

export type FocusMeasure = (typeof FOCUS_MEASURE)[keyof typeof FOCUS_MEASURE];

export interface FocusColumnProps {
  /**
   * Which of the two measures the prototypes actually draw. Both are extracted values (OQ-10), not
   * a scale — a third one is a question for design, not a prop this component should accept.
   */
  measure?: FocusMeasure;
  children: ReactNode;
}

export function FocusColumn({ measure = FOCUS_MEASURE.NARROW, children }: FocusColumnProps) {
  return (
    <main className={styles.main}>
      <div className={measure === FOCUS_MEASURE.WIDE ? styles.wide : styles.narrow}>{children}</div>
    </main>
  );
}
