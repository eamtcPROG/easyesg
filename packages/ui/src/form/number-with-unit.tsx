import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './number-with-unit.module.css';

/**
 * Number with unit — §11.5's form control, built with task 221 as `design/screens/EasyESG Components.dc.html` draws it:
 * *"composed · ui/input.tsx + ui/select.tsx"*. A figure's value and its unit side by side — the value's box filling the
 * row and the unit in its own box beside it — with the figure's label, where the row carries one, above both.
 *
 * **It composes; it draws neither box.** The value is the caller's `TextField` — whose `inputmode="decimal"` is what sets
 * the figure's type (`field.value.font`), so a number reads the same with or without a unit — and the unit is a
 * `UnitLabel` where the taxonomy or the filing fixes it, or a `Select` where it is chosen from a list (UX-14: never free
 * text). The slot hands a chosen unit's select the unit surface through `--field-surface`, an inherited property the
 * select reads, so the two look like the one unit box they stand for without this reaching into the select's markup.
 * Every state is therefore its parts' own, which is how §8.1's set is met here.
 *
 * **The unit is beside the value's box, not beside its column**: the row is top-aligned, so a message growing beneath
 * the value — a refusal, a question, what was recorded — leaves the unit where it was (task 220's finding).
 *
 * **The label is optional because the disclosure field already names its row**: inside `DisclosureField` the question is
 * the label and the value points at it. Elsewhere — S-09's add-source form — the row names itself and the value's own
 * label is hidden, so the words are read once and drawn once.
 */
export interface NumberWithUnitProps {
  /** The value's control — a `TextField` with `inputMode="decimal"`, or a figure shown read-only. */
  children: ReactNode;
  /** A `UnitLabel`, or a `Select` over the admitted units. Absent where the standard states none. */
  unit?: ReactNode;
  /** The figure's visible label, above both boxes; the row becomes a group named by it. */
  label?: ReactNode;
}

export function NumberWithUnit({ children, unit, label }: NumberWithUnitProps) {
  const labelId = useId();
  return (
    <div
      className={styles.field}
      role={label === undefined ? undefined : 'group'}
      aria-labelledby={label === undefined ? undefined : labelId}
    >
      {label === undefined ? null : (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      )}
      <div className={styles.row}>
        <div className={styles.value}>{children}</div>
        {unit === undefined || unit === null ? null : <div className={styles.unit}>{unit}</div>}
      </div>
    </div>
  );
}
