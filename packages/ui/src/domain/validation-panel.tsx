import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './validation-panel.module.css';

/**
 * Validation panel — §11.5's domain component and S-08's frame (task 42.2; UC-37 … UC-40, UX-20, UX-24), as the
 * Reporting Core artboard draws it: a heading with when the report was last checked and the run control beside it, the
 * completeness meter, the filters, and the findings grouped by module.
 *
 * **A frame, and nothing it frames.** The meter, the filters, each group and each finding are the caller's nodes, built
 * from this package's own parts (`CompletenessMeter`, `ValidationGroup`, `ValidationFinding`) — so the same panel is
 * docked beside the step and raised as a sheet below `wide` with no second drawing of either. **Breakpoint-agnostic**
 * for that reason: where it is shown is `ValidationDock`'s and the sheet's.
 *
 * **A region named by its own heading**, inside the shell's `aside`: a screen reader finds *Validation* among the
 * landmarks and reads its heading first. **`busy` marks the pending state** (§8.5: *validation in flight, with inline
 * progress on the roll-up while the wizard stays interactive*) — `aria-busy` on the region, so assistive technology
 * waits for the settled counts, while the caller's `checked` line says in words that a check is running.
 *
 * States (§8.1): empty — first use, and empty — filtered, are the caller's nodes in `children`; loading — initial is
 * the step's own (the panel is read with the step); pending — `busy`; error — recoverable, the caller's callout in
 * `children`; read-only — the caller passes no `action`.
 */
export interface ValidationPanelProps {
  /** The panel's heading — *Validation*. */
  readonly title: ReactNode;
  /** When the report was last checked, or that it never was, or that a check is running. */
  readonly checked: ReactNode;
  /** The run control — *check my report* — absent for a reader who may not run one (182/22). */
  readonly action?: ReactNode;
  /** `CompletenessMeter`, where there is a roll-up to draw. */
  readonly meter?: ReactNode;
  /** The filters over the findings. */
  readonly filters?: ReactNode;
  /** A check in flight — the region is marked busy until it settles. */
  readonly busy?: boolean;
  /** The groups of findings, or the state that stands in for them. */
  readonly children: ReactNode;
}

export function ValidationPanel({ title, checked, action, meter, filters, busy = false, children }: ValidationPanelProps) {
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId} aria-busy={busy || undefined}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <p className={styles.checked}>{checked}</p>
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
      {meter ? <div className={styles.meter}>{meter}</div> : null}
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
