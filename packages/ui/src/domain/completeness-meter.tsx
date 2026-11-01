import type { ReactNode } from 'react';
import styles from './completeness-meter.module.css';

/**
 * Completeness meter — §11.5's domain component, which *"reports resolved / reasoned / outstanding and never a single
 * percentage"* (FR-41 item 5, 182/18). **Built by task 42.2 for S-08**, where UC-38's roll-up is drawn.
 *
 * **One bar of three runs and a legend in words.** Each run is as long as its count is a share of the three, so the bar
 * shows proportion without printing one; the legend states each count in the caller's words — *12 answered* — beside
 * its swatch. **The bar is decoration** (hidden from assistive technology) and the legend is the reading, so no state
 * is carried by colour alone (UX-23) and nothing is said twice to a screen reader.
 *
 * **No percentage, and no total either**, by construction: a sum is the step towards the percentage the decision
 * forbids, and the caller has the counts if a sentence needs one.
 *
 * States (§8.1): **success** — the counts as given; **empty** — all three zero draws the bar's empty track and the
 * legend still states three zeros; **loading** — none of its own, the panel's pending state stands in.
 */
export interface CompletenessMeterProps {
  readonly counts: { readonly resolved: number; readonly reasoned: number; readonly outstanding: number };
  /** Each count in the caller's words, already formatted — this package owns no text. */
  readonly legend: { readonly resolved: ReactNode; readonly reasoned: ReactNode; readonly outstanding: ReactNode };
}

const RUNS = ['resolved', 'reasoned', 'outstanding'] as const;

export function CompletenessMeter({ counts, legend }: CompletenessMeterProps) {
  return (
    <div className={styles.meter}>
      <div className={styles.bar} aria-hidden="true">
        {RUNS.map((run) =>
          counts[run] > 0 ? (
            // The run's share as its flex weight — a proportion drawn, never a figure printed.
            <span key={run} className={styles.run} data-run={run} style={{ flexGrow: counts[run] }} />
          ) : null,
        )}
      </div>
      <ul className={styles.legend}>
        {RUNS.map((run) => (
          <li key={run} className={styles.item}>
            <span className={styles.swatch} data-run={run} aria-hidden="true" />
            <span>{legend[run]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
