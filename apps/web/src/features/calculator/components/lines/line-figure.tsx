'use client';

import styles from '../styles/calculator.module.css';
import { CommitField } from './commit-field';
import { LineUnit } from './line-unit';

/**
 * A line's one figure for the period and its unit, side by side as the bill reads (task 39.1; UX-40). **What they mean
 * is the row's business**: this hands back what was typed and what was chosen, and the row decides what to write.
 */
export function LineFigure({
  label,
  quantity,
  units,
  unit,
  onQuantity,
  onUnit,
}: {
  /** The figure's accessible name. */
  readonly label: string;
  readonly quantity: string | null;
  readonly units: readonly string[];
  readonly unit: string | null;
  readonly onQuantity: (draft: string) => string | null;
  readonly onUnit: (code: string) => void;
}) {
  return (
    <div className={styles.figure}>
      <CommitField key={quantity ?? ''} label={label} labelHidden inputMode="decimal" value={quantity ?? ''} onCommit={onQuantity} />
      <LineUnit units={units} unit={unit} onUnit={onUnit} />
    </div>
  );
}
