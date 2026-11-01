'use client';

import { NumberWithUnit } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { NumberField } from '@/shared/number-field';
import { readFigure } from '../../tools/figure-input';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import { LineUnit } from './line-unit';

/**
 * A line's one figure for the period and its unit, side by side as the bill reads (task 39.1; UX-40) — §11.5's
 * Number-with-unit since task 221. **What they mean is the row's business**: this hands back what was typed and what was
 * chosen, and the row decides what to write.
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
  /** The figure read (`NumberField`), or `null` emptied. Answers the refusal's words, or `null`. */
  readonly onQuantity: (value: string | null) => string | null;
  readonly onUnit: (code: string) => void;
}) {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const format = useFormatter();
  const { unitName } = useCalculatorWords();
  return (
    <NumberWithUnit unit={<LineUnit units={units} unit={unit} onUnit={onUnit} />}>
      <NumberField
        label={label}
        labelHidden
        value={quantity ?? ''}
        invalidWords={t('line.invalidNumber')}
        read={(raw) => readFigure({ raw, format })}
        onCommit={onQuantity}
        unit={unit === null ? null : unitName(unit)}
      />
    </NumberWithUnit>
  );
}
