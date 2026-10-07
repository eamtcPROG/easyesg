'use client';

import { Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';

/**
 * A line's unit (task 39.1; UX-14, UX-40): fixed where the source is entered in one, chosen from the source's own list
 * where it is entered in several, never typed. **No default among several** — a grid figure read off a bill in kWh as
 * though it were MWh is the thousand-fold mistake the artboard warns about, so the reader picks the one printed.
 * Beside the one figure, and above the twelve months, whose unit it is too.
 */
export function LineUnit({
  units,
  unit,
  onUnit,
}: {
  readonly units: readonly string[];
  /** The unit in force — stored, chosen, or the only one there is. */
  readonly unit: string | null;
  readonly onUnit: (code: string) => void;
}) {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const { unitName } = useCalculatorWords();
  if (units.length === 1) return <span className={styles.unit}>{unitName(units[0])}</span>;
  return (
    <Select
      label={t('line.unit')}
      labelHidden
      placeholder={t('line.chooseUnit')}
      value={unit ?? undefined}
      onValueChange={onUnit}
      options={units.map((code) => ({ value: code, label: unitName(code) }))}
    />
  );
}
