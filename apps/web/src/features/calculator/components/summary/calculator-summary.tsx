'use client';

import type { Calculator } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCalculator } from '@/client/calculator/use-calculator';
import { useAutosaveContext } from '@/features/wizard/components/providers/autosave-context';
import { isLineRemoval, isQueuedLine } from '@/features/wizard/tools/autosave-state';
import { formatFigure } from '@/lib/figure-format';
import { FIGURE_UNIT } from '../../tools/figure-unit';
import { RUN_STANDING, runStanding, type RunStanding } from '../../tools/run-standing';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { REFUSAL_ABOUT } from '../../tools/refusal-about';
import { RequestRefusal } from '../shared/request-refusal';
import { useCalculatorWords } from '../shared/use-calculator-words';
import { useRecordRun } from '../shared/use-record-run';
import styles from '../styles/calculator.module.css';

/**
 * *What goes back to B3* (task 39.2; UC-33; the artboard's 8.2): Scope 1 and location-based Scope 2 as the lines come to
 * now, what each leaves out, the factor set they are against and when B3 last took its figures from it — and the one
 * act, *use these figures in B3*, which records the run and hands back to B3.
 *
 * **Beside the step, in the shell's panel**, as the artboard docks it at `wide`, and beneath the lines below it. **The
 * totals follow the lines and nothing is written into B3 until the button is pressed** — the artboard's own sentence,
 * which is §12.5.6's task-38.1 row declining a run per keystroke, said to the reader.
 *
 * **The button says why it waits** (`run-standing.ts`) rather than greying out silently: offline, a line still being
 * saved, a line the set no longer covers. A refusal from the api is shown here in its own three parts.
 */
export function CalculatorSummary({
  reportId,
  initial,
  readOnly,
}: {
  readonly reportId: string;
  readonly initial: Calculator;
  readonly readOnly: boolean;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.summary`);
  const tMeasure = useTranslations(CALCULATOR_MESSAGES);
  const format = useFormatter();
  const { unitName, scopeName } = useCalculatorWords();
  const { state, hasUnsynced } = useAutosaveContext();
  const calculator = useCalculator({ reportId, initial, committedLines: state.committedLines });
  const { record, pending, failure } = useRecordRun(reportId);

  const scopes = calculator.working?.scopes ?? [];
  const standing = runStanding({
    readOnly,
    hasFactorSet: calculator.factorSet !== null,
    // A line still in the queue counts: it is a line the reader has, and the queue is the reason the run waits.
    lines:
      calculator.sources.length +
      Object.values(state.pending).filter((each) => isQueuedLine(each.write) && !isLineRemoval(each.write)).length,
    connection: state.connection,
    unsynced: hasUnsynced,
    uncovered: calculator.working?.uncovered.length ?? 0,
  });
  // Why the button waits, in words — literal keys, so a reason the catalogue does not word fails `pnpm typecheck`.
  const waiting: Readonly<Record<Exclude<RunStanding, typeof RUN_STANDING.READY | typeof RUN_STANDING.READ_ONLY>, string>> = {
    [RUN_STANDING.NO_FACTOR_SET]: t('standing.no_factor_set'),
    [RUN_STANDING.NO_LINES]: t('standing.no_lines'),
    [RUN_STANDING.OFFLINE]: t('standing.offline'),
    [RUN_STANDING.UNSENT]: t('standing.unsent'),
    [RUN_STANDING.UNCOVERED]: t('standing.uncovered', { count: calculator.working?.uncovered.length ?? 0 }),
  };
  const tonnes = (value: string) =>
    tMeasure('measure', {
      value: formatFigure({ value, places: calculator.precision[FIGURE_UNIT.TONNES], format }),
      unit: unitName(FIGURE_UNIT.TONNES),
    });

  return (
    <section className={styles.summary} aria-labelledby="calculator-summary-heading">
      <h2 id="calculator-summary-heading" className={styles.summaryHeading}>
        {t('heading')}
      </h2>
      <dl className={styles.totals}>
        {scopes.map((scope) => (
          <div key={scope.ghgScope} className={styles.total}>
            <dt>{scopeName(scope.ghgScope)}</dt>
            <dd className={styles.totalFigure}>{scope.tonnesCo2e === null ? t('none') : tonnes(scope.tonnesCo2e)}</dd>
            {scope.unmeasured.length === 0 ? null : (
              <dd className={styles.totalNote}>{t('unmeasured', { count: scope.unmeasured.length })}</dd>
            )}
          </div>
        ))}
      </dl>

      {calculator.factorSet === null ? null : (
        <div className={styles.pinned}>
          <p className={styles.pinnedLabel}>{t('factorSet')}</p>
          <p className={styles.pinnedName}>{calculator.factorSet.label}</p>
          <p className={styles.pinnedNote}>
            {calculator.latestRun === null
              ? t('notYet')
              : t('lastUsed', {
                  date: format.dateTime(new Date(calculator.latestRun.recordedAt), { dateStyle: 'long' }),
                })}
          </p>
        </div>
      )}

      {readOnly ? null : (
        <>
          <Button
            variant={BUTTON_VARIANT.PRIMARY}
            busy={pending}
            disabled={standing !== RUN_STANDING.READY}
            onClick={record}
          >
            {t('use')}
          </Button>
          <p className={styles.summaryNote}>
            {standing === RUN_STANDING.READY || standing === RUN_STANDING.READ_ONLY ? t('note') : waiting[standing]}
          </p>
        </>
      )}
      {failure === null ? null : <RequestRefusal failure={failure} about={REFUSAL_ABOUT.RUN} />}
    </section>
  );
}
