import type { ReactNode } from 'react';
import type { FindingWeight } from './validation-vocabulary';
import styles from './validation-finding.module.css';

/**
 * One finding in S-08 — §11.5's *Validation finding*, *"always a link to the field"* (task 42.2; FR-42, UX-22): the
 * field it sits on, its weight, the same sentence the field shows, and the way to the field.
 *
 * **The way to the field is the caller's node in `actions`**, because the link is the app's router's and this package
 * holds none; that every finding carries one is S-08's rule, which the app's own spec holds. **The weight is drawn in
 * words and a tone** — never colour alone (UX-23): *Must fix* in the error role, *Review* in the warning role, and a
 * finding cleared since the last check muted with its words saying so.
 *
 * States (§8.1): rest; the three weights; focus belongs to the link inside `actions`.
 */
export interface ValidationFindingProps {
  /** The field's label — *Annual turnover*. */
  readonly field: ReactNode;
  /** Which row or member of the field, where it has one — *Moldova*, *Site 2*. */
  readonly detail?: ReactNode;
  readonly weight: FindingWeight;
  /** The weight in the caller's words — *Must fix*. */
  readonly weightLabel: ReactNode;
  /** The finding's sentence, the same the field shows. */
  readonly message: ReactNode;
  /** *Go to the field*, and the field it conflicts with where it has one. */
  readonly actions?: ReactNode;
}

export function ValidationFinding({ field, detail, weight, weightLabel, message, actions }: ValidationFindingProps) {
  return (
    // `data-weight` rather than a conditional class: the stylesheet keys off it and a spec reads it, so deleting the
    // signal cannot leave tests green (`UsageCounter`'s reason).
    <li className={styles.finding} data-weight={weight}>
      <div className={styles.head}>
        <span className={styles.field}>
          {field}
          {detail ? <span className={styles.detail}>{detail}</span> : null}
        </span>
        <span className={styles.weight} data-weight={weight}>
          {weightLabel}
        </span>
      </div>
      <p className={styles.message}>{message}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </li>
  );
}
