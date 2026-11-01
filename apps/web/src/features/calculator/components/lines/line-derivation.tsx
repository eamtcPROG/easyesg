'use client';

import type { CalcFactorSource, CalcScopeLine } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { formatFigure } from '@/lib/figure-format';
import { FIGURE_UNIT } from '../../tools/figure-unit';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';

/**
 * UX-42's derivation in one step (task 39.2; the artboard's 8.4): what was entered, its conversion to energy, the factor
 * applied, the tonnes reported — four stated steps, each with what went in and what came out, ending in the factor set
 * the figure comes from. Opened in place on its row, and an address (`?line=`), so a question about one line is answered
 * with a link.
 *
 * **In the units the set publishes and B3 reports — MWh and tCO₂e** (§12.5.6's task-39 row (6)): the rate and the factor
 * are shown with every digit, exactly as published, so each can be found in the set; only the results are rounded, once,
 * to the configured places, and the step says the unrounded figure is kept.
 */
export function LineDerivation({
  quantity,
  unit,
  source,
  result,
  setLabel,
  precision,
}: {
  readonly quantity: string;
  readonly unit: string;
  readonly source: CalcFactorSource;
  readonly result: CalcScopeLine;
  readonly setLabel: string;
  readonly precision: Readonly<Record<string, number>>;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.derivation`);
  const tMeasure = useTranslations(CALCULATOR_MESSAGES);
  const measure = (value: string, code: string) => tMeasure('measure', { value, unit: unitName(code) });
  const format = useFormatter();
  const { unitName } = useCalculatorWords();
  const exact = (value: string) => formatFigure({ value, places: undefined, format });
  const rounded = (value: string, code: string) => formatFigure({ value, places: precision[code], format });
  const rate = source.megawattHoursPerUnit[unit];
  const tonnes = result.computedTonnesCo2e ?? result.tonnesCo2e;

  return (
    <div className={styles.derivation}>
      <p className={styles.derivationHeading}>
        {t('heading', {
          quantity: exact(quantity),
          unit: unitName(unit),
          tonnes: tonnes === null ? '—' : rounded(tonnes, FIGURE_UNIT.TONNES),
        })}
      </p>
      <ol className={styles.steps}>
        <li>
          <span className={styles.stepTitle}>{t('entered.title')}</span>
          <span className={styles.stepDetail}>{t('entered.detail')}</span>
          <span className={styles.stepValue}>{measure(exact(quantity), unit)}</span>
        </li>
        <li>
          <span className={styles.stepTitle}>{t('converted.title')}</span>
          <span className={styles.stepDetail}>
            {t('converted.detail', { rate: rate === undefined ? '—' : exact(rate), unit: unitName(unit) })}
          </span>
          <span className={styles.stepValue}>
            {result.megawattHours === null
              ? '—'
              : measure(rounded(result.megawattHours, FIGURE_UNIT.ENERGY), FIGURE_UNIT.ENERGY)}
          </span>
        </li>
        <li>
          <span className={styles.stepTitle}>{t('factor.title')}</span>
          <span className={styles.stepDetail}>
            {t('factor.detail', { factor: exact(source.emissionFactor) })} {source.reference}
          </span>
        </li>
        <li>
          <span className={styles.stepTitle}>{t('reported.title')}</span>
          <span className={styles.stepDetail}>{t('reported.detail', { places: precision[FIGURE_UNIT.TONNES] ?? -1 })}</span>
          <span className={styles.stepValue}>
            {tonnes === null ? '—' : measure(rounded(tonnes, FIGURE_UNIT.TONNES), FIGURE_UNIT.TONNES)}
          </span>
        </li>
      </ol>
      <p className={styles.derivationSet}>{t('set', { label: setLabel })}</p>
    </div>
  );
}
