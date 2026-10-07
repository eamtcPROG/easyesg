'use client';

import type { Calculator } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { factorChange } from '../../tools/factor-change';
import { formatFigure } from '@/lib/figure-format';
import { FIGURE_UNIT } from '../../tools/figure-unit';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import { REFUSAL_ABOUT } from '../../tools/refusal-about';
import { RequestRefusal } from '../shared/request-refusal';
import { useRecordRun } from '../shared/use-record-run';
import styles from '../styles/calculator.module.css';

/**
 * UX-44 (task 39.2; §12.5.6's task-39 row (4); the artboard's 8.6): **a newer set is in force than the one B3's figures
 * were computed with** — named, with each figure *now* beside what it *would be*, and one offer, to recalculate, which
 * records a run and hands back to B3. Above the table, where the numbers are, and non-blocking: the lines stay editable
 * beneath it.
 *
 * **It stores no dismissal and offers no *keep***: it stands while the two sets differ and leaves when the report is
 * recalculated — the decision is the run, and nothing restates a figure behind the reader's back (P7). On a report
 * nobody may write to it still says the sets differ, with no offer to act on.
 */
export function FactorUpdateNotice({
  reportId,
  calculator,
  readOnly,
}: {
  readonly reportId: string;
  readonly calculator: Calculator;
  readonly readOnly: boolean;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.notice`);
  const tSummary = useTranslations(`${CALCULATOR_MESSAGES}.summary`);
  const tMeasure = useTranslations(CALCULATOR_MESSAGES);
  const format = useFormatter();
  const { unitName, scopeName } = useCalculatorWords();
  const { record, pending, failure } = useRecordRun(reportId);
  const change = factorChange(calculator);
  if (change === null) return null;

  const figure = (value: string | null) =>
    value === null
      ? tSummary('none')
      : tMeasure('measure', {
          value: formatFigure({ value, places: calculator.precision[FIGURE_UNIT.TONNES], format }),
          unit: unitName(FIGURE_UNIT.TONNES),
        });

  return (
    <Callout
      intent={CALLOUT_INTENT.WARNING}
      title={t('title')}
      action={
        readOnly ? null : (
          <Button variant={BUTTON_VARIANT.PRIMARY} busy={pending} onClick={record}>
            {t('recalculate', { current: change.current })}
          </Button>
        )
      }
    >
      <p>
        {t('body', {
          pinned: change.pinned === null ? t('unknownPinned') : t('pinnedSet', { label: change.pinned }),
          current: change.current,
        })}
      </p>
      <table className={styles.change}>
        <thead>
          <tr>
            <th scope="col">{t('figure')}</th>
            <th scope="col">{t('now')}</th>
            <th scope="col">{t('wouldBe')}</th>
          </tr>
        </thead>
        <tbody>
          {change.figures.map((row) => (
            <tr key={row.ghgScope}>
              <th scope="row">{scopeName(row.ghgScope)}</th>
              <td>{figure(row.now)}</td>
              <td>{figure(row.wouldBe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {failure === null ? null : <RequestRefusal failure={failure} about={REFUSAL_ABOUT.RUN} />}
    </Callout>
  );
}
