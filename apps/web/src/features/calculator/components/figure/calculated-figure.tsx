'use client';

import { DISCLOSURE_ORIGIN, type DisclosureField } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT, TextLink } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAutosaveContext } from '@/features/wizard/components/providers/autosave-context';
import { useStepFigures } from '@/features/wizard/components/providers/step-figures-context';
import { StepLink } from '@/features/wizard/components/shared/step-link';
import { CONNECTION } from '@/features/wizard/tools/autosave-state';
import { formatFigure } from '@/lib/figure-format';
import { reportCalculatorRoute } from '@/lib/routes';
import { FIGURE_UNIT } from '../../tools/figure-unit';
import { explainFigureAction, overrideFigureAction, restoreFigureAction } from '../../actions/actions';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { FigureOverrideForm } from '../shared/figure-override-form';
import { REFUSAL_ABOUT } from '../../tools/refusal-about';
import { RequestRefusal } from '../shared/request-refusal';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';
import { FigureExplainForm } from './figure-explain-form';
import { useFigureAction } from './use-figure-action';

/**
 * A B3 scope a calculator run wrote, on S-07 (task 39.3; UC-34, FR-36, UX-43; the artboard's 8.1 *after* and 8.5):
 * the figure, rounded once to its unit's places, and UC-34's three acts — **replace it** with the reporter's tonnes and a
 * reason, **explain it** with a note, or, once replaced, **put the computed figure back** in one action.
 *
 * **A replaced figure is never shown alone** (UX-43): the substitute, the computed figure it superseded — the latest
 * run's stored result, read beside the step — the reason, and since task 39.4 the person who made it (FR-36), together. A computed figure keeps its note through a
 * re-run; a later run replaces a substitute, its reason going with it (§12.5.6's task-38.4 row (4)).
 *
 * **Direct requests, and they need a connection** (§12.5.6's task-39 row (2)): offline, the acts are withheld with the
 * reason said. Which form is open is one value nothing else moves with — one `useState`.
 */
export function CalculatedFigure({ field, readOnly }: { readonly field: DisclosureField; readonly readOnly: boolean }) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.figure`);
  const tOverride = useTranslations(`${CALCULATOR_MESSAGES}.override`);
  const tMeasure = useTranslations(CALCULATOR_MESSAGES);
  const format = useFormatter();
  const { unitName } = useCalculatorWords();
  const { reportId, precision, calculator } = useStepFigures();
  const { state } = useAutosaveContext();
  const { run, pending, failure } = useFigureAction();
  const [open, setOpen] = useState<FigureForm | null>(null);

  const tonnes = (value: string | null) =>
    value === null
      ? '—'
      : tMeasure('measure', {
          value: formatFigure({ value, places: precision[FIGURE_UNIT.TONNES], format }),
          unit: unitName(FIGURE_UNIT.TONNES),
        });
  const overridden = field.origin === DISCLOSURE_ORIGIN.OVERRIDDEN;
  // Who replaced it (task 39.4; FR-36), named as the account reads now — nothing where the account is gone.
  const overrider = field.overriddenBy?.name ?? null;
  const latest = calculator?.latestRun ?? null;
  const computed = latest?.results.find((result) => result.elementKey === field.elementKey)?.tonnesCo2e ?? null;
  const offline = state.connection === CONNECTION.OFFLINE;
  const target = { reportId, elementKey: field.elementKey };

  return (
    <div className={styles.calculated}>
      {overridden ? (
        <>
          <p className={styles.calculatedFigure}>{t('yours', { figure: tonnes(field.valueNumeric) })}</p>
          <p className={styles.superseded}>{t('superseded', { figure: tonnes(computed) })}</p>
          {overrider === null ? null : <p className={styles.calculatedSource}>{tOverride('by', { name: overrider })}</p>}
          <p className={styles.calculatedReason}>
            <span className={styles.noFigure}>{t('reason')}</span> {field.explanation}
          </p>
        </>
      ) : (
        <>
          <p className={styles.calculatedFigure}>{tonnes(field.valueNumeric)}</p>
          {latest === null ? null : (
            <p className={styles.calculatedSource}>
              {t('from', {
                label: latest.factorSet.label ?? t('unknownSet'),
                date: format.dateTime(new Date(latest.recordedAt), 'long'),
              })}
            </p>
          )}
          {field.explanation === null ? null : (
            <p className={styles.calculatedReason}>
              <span className={styles.noFigure}>{t('noteLabel')}</span> {field.explanation}
            </p>
          )}
        </>
      )}

      <TextLink asChild>
        <StepLink href={reportCalculatorRoute({ reportId })}>{t('how')}</StepLink>
      </TextLink>

      {readOnly ? null : open === FIGURE_FORM.OVERRIDE ? (
        <FigureOverrideForm
          initial={overridden ? { tonnes: field.valueNumeric ?? '', reason: field.explanation ?? '' } : null}
          pending={pending}
          cancelLabel={overridden ? t('cancel') : tOverride('keep')}
          onSubmit={(override) =>
            run(
              () =>
                overrideFigureAction({ ...target, valueNumeric: override.tonnesCo2e, explanation: override.explanation }),
              () => setOpen(null),
            )
          }
          onCancel={() => setOpen(null)}
        />
      ) : open === FIGURE_FORM.EXPLAIN ? (
        <FigureExplainForm
          initial={field.explanation}
          pending={pending}
          onSubmit={(explanation) => run(() => explainFigureAction({ ...target, explanation }), () => setOpen(null))}
          onCancel={() => setOpen(null)}
        />
      ) : (
        <div className={styles.lineActions}>
          {overridden ? (
            <Button
              variant={BUTTON_VARIANT.SECONDARY}
              busy={pending}
              disabled={offline}
              onClick={() => run(() => restoreFigureAction(target))}
            >
              {t('restore')}
            </Button>
          ) : null}
          <Button variant={BUTTON_VARIANT.SUBTLE} disabled={offline} onClick={() => setOpen(FIGURE_FORM.OVERRIDE)}>
            {overridden ? t('change') : t('replace')}
          </Button>
          {overridden ? null : (
            <Button variant={BUTTON_VARIANT.SUBTLE} disabled={offline} onClick={() => setOpen(FIGURE_FORM.EXPLAIN)}>
              {field.explanation === null ? t('explain') : t('changeNote')}
            </Button>
          )}
        </div>
      )}
      {offline && !readOnly ? <p className={styles.summaryNote}>{t('offline')}</p> : null}
      {failure === null ? null : <RequestRefusal failure={failure} about={REFUSAL_ABOUT.FIGURE} />}
    </div>
  );
}

/** Which of UC-34's forms is open in the control. */
const FIGURE_FORM = { OVERRIDE: 'override', EXPLAIN: 'explain' } as const;

type FigureForm = (typeof FIGURE_FORM)[keyof typeof FIGURE_FORM];
