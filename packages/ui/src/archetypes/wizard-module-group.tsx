import type { ReactNode } from 'react';
import type { WizardStepState } from './wizard-step-vocabulary';
import styles from './wizard-module-group.module.css';

/**
 * A named group of steps with its roll-up — the Reporting Core rail's head, *Basic module · 5 of 10 done*, a bar of one
 * segment per step and a sentence on what is discounted and what waits, then the steps (task 179.1). The Comprehensive
 * Module is a second group in the same list, as the artboard's *rail after adding* draws it.
 *
 * **The bar is decoration and says so**: hidden from assistive technology, because the count beside it is the same fact
 * in words and each step says its own state. Its segments are the steps' states, in the steps' order.
 *
 * **The group's name labels its list rather than being a heading**: the list stands before the step's `h1` in the
 * document, and a heading here would put an `h2` above the page's only `h1`.
 *
 * States (§8.1, the applicable subset): rest; the note absent where nothing is discounted or waiting.
 */
export interface WizardModuleGroupProps {
  /** *Basic Module*. Localized by the caller; also the list's accessible name. */
  readonly name: string;
  /** *5 of 10 done*. */
  readonly count: ReactNode;
  /** One per step, in the steps' order. */
  readonly segments: readonly { readonly key: string; readonly state: WizardStepState }[];
  /** What is discounted from the count and what waits — omitted when there is neither. */
  readonly note?: ReactNode;
  /** `WizardModuleItem`s. */
  readonly children: ReactNode;
}

export function WizardModuleGroup({ name, count, segments, note, children }: WizardModuleGroupProps) {
  return (
    <div className={styles.group}>
      <div className={styles.rollUp}>
        <p className={styles.heading}>
          <span className={styles.name}>{name}</span>
          <span className={styles.count}>{count}</span>
        </p>
        <span className={styles.segments} aria-hidden="true">
          {segments.map((segment) => (
            <span key={segment.key} className={styles.segment} data-state={segment.state} />
          ))}
        </span>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
      <ol className={styles.steps} aria-label={name}>
        {children}
      </ol>
    </div>
  );
}
