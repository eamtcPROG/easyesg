'use client';

import type { CalcFactorSource } from '@easyesg/contracts';
import {
  Button,
  BUTTON_VARIANT,
  SAVE_STATE,
  STATUS_TONE,
  StatusChip,
  type SaveState,
  type StatusTone,
} from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { useAutosaveContext } from '@/features/wizard/components/providers/autosave-context';
import { syncStateOf, writeKey } from '@/features/wizard/tools/autosave-state';
import type { Computation } from '../../tools/computation';
import { formatFigure } from '@/lib/figure-format';
import { readFigure } from '../../tools/figure-input';
import { FIGURE_UNIT } from '../../tools/figure-unit';
import { LINE_DISPLAY, lineDisplay } from '../../tools/line-display';
import { LINE_ENTRY, storedEntry, type LineEntry } from '../../tools/line-entry';
import { fieldsOf, withMonth, writeOf, type LineFields } from '../../tools/line-write';
import type { LineView } from '../../tools/lines';
import { monthTotal } from '../../tools/month-total';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { useCalculatorWords } from '../shared/use-calculator-words';
import styles from '../styles/calculator.module.css';
import { CommitArea } from './commit-area';
import { CommitField } from './commit-field';
import { LineDerivation } from './line-derivation';
import { LineFigure } from './line-figure';
import { LineMonths } from './line-months';
import { LineOverride } from './line-override';
import { LineUnit } from './line-unit';

/**
 * One invoice line (task 39.1; UC-32, FR-33, UX-40, UX-41): what it is and where, what the bill says, and over which
 * period — editable after a calculation as the permanent record it is, read-only as text where nothing may be written.
 *
 * **Every edit becomes the line's whole write here, and goes into the wizard's queue** (§12.5.6's task-39 row (2)):
 * a figure, a month, a unit, a name, a reason — `writeOf` builds the request, `change` queues it, and the row shows the
 * queue's word for it until the api has it (§4.10's per-field marker). A change the api could not take — no figure and
 * no reason — is said at the field and never sent.
 *
 * **Two pieces of the row's own state, and they are independent**: the entry the reader has chosen, before the line
 * holds it (`line-entry.ts`), and a unit chosen before the figure that needs it. Neither moves with the other, so they
 * are two `useState`s rather than one reducer.
 */
export function LineRow({
  line,
  source,
  months,
  readOnly,
  computation,
  derivation,
}: {
  readonly line: LineView;
  /** The factor set's source the line names, or `undefined` where the set no longer carries it. */
  readonly source: CalcFactorSource | undefined;
  /** The monthly form's calendar months, or `null` where the period offers none. */
  readonly months: readonly string[] | null;
  readonly readOnly: boolean;
  /** The figures around the line, read once by the board (task 39.2). */
  readonly computation: Computation;
  /** Whether this line's derivation is the one the address opens, and the addresses that open and close it. */
  readonly derivation: { readonly open: boolean; readonly openHref: string; readonly closeHref: string };
}) {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const tSync = useTranslations('organization.wizard.field.sync');
  const format = useFormatter();
  const { sourceName, unitName, scopeName } = useCalculatorWords();
  const { state, change } = useAutosaveContext();
  const [chosen, setChosen] = useState<LineEntry | null>(null);
  const [unitChoice, setUnitChoice] = useState<string | null>(null);

  const fields = fieldsOf(line);
  const entry = chosen ?? storedEntry(line);
  const units = source?.units ?? (line.unitCode === null ? [] : [line.unitCode]);
  const unit = line.unitCode ?? unitChoice ?? (units.length === 1 ? units[0] : null);
  const name = sourceName(line.sourceKey);

  /** The line written whole, or why it could not be. */
  const save = (next: LineFields): string | null => {
    const request = writeOf(next);
    if (request === null) return t('line.required');
    change({ lineId: line.id, line: request });
    return null;
  };

  const onQuantity = (draft: string): string | null => {
    const read = readFigure(draft);
    if ('invalid' in read) return t('line.invalidNumber');
    if (read.value === null) return t('line.required');
    if (unit === null) return t('add.unitRequired');
    return save({ ...fields, quantity: read.value, unitCode: unit, notAvailableReason: null, monthlyQuantities: null });
  };

  const onUnit = (code: string): void => {
    if (entry === LINE_ENTRY.FIGURE && line.quantity !== null && line.notAvailableReason === null) {
      save({ ...fields, unitCode: code, monthlyQuantities: null });
    } else if (entry === LINE_ENTRY.MONTHS && line.monthlyQuantities !== null) {
      save({ ...fields, unitCode: code });
    } else {
      setUnitChoice(code);
    }
  };

  const onMonth = ({ index, draft }: { readonly index: number; readonly draft: string }): string | null => {
    const read = readFigure(draft);
    if ('invalid' in read) return t('line.invalidNumber');
    if (unit === null) return t('add.unitRequired');
    const next = withMonth({ months: line.monthlyQuantities, index, value: read.value, length: months?.length ?? 0 });
    const request = writeOf({ ...fields, unitCode: unit, notAvailableReason: null, monthlyQuantities: next });
    if (request === null) return t('months.noTotal');
    change({ lineId: line.id, line: request });
    return null;
  };

  const toAnnual = (): void => {
    if (line.monthlyQuantities !== null) {
      save({ ...fields, quantity: monthTotal(line.monthlyQuantities), monthlyQuantities: null });
    }
    setChosen(LINE_ENTRY.FIGURE);
  };

  const onReason = (draft: string): string | null =>
    draft.trim() === ''
      ? t('add.reasonRequired')
      : save({
          ...fields,
          notAvailableReason: draft.trim(),
          quantity: null,
          unitCode: null,
          monthlyQuantities: null,
          overrideTonnes: null,
          overrideExplanation: null,
        });

  const sync = syncStateOf(state, writeKey({ lineId: line.id }));
  // What the line comes to (task 39.2), rounded once to the configured places — or why it has none (`line-display.ts`).
  const result = computation.results.get(line.id);
  const display = lineDisplay({ line, result, uncovered: computation.uncovered.has(line.id) });
  // The bill's own figure, shown to be read rather than typed: every digit, laid out for the locale (NFR-26).
  const typed = (value: string) => formatFigure({ value, places: undefined, format });
  const monthlyTotal = monthTotal(line.monthlyQuantities ?? []);
  const rounded = (value: string, code: string) =>
    t('measure', { value: formatFigure({ value, places: computation.precision[code], format }), unit: unitName(code) });
  const converted =
    display.kind === LINE_DISPLAY.COMPUTED
      ? rounded(display.megawattHours, FIGURE_UNIT.ENERGY)
      : display.kind === LINE_DISPLAY.WAITING
        ? t('line.waiting')
        : display.kind === LINE_DISPLAY.UNCOVERED
          ? t('line.uncovered')
          : '—';
  const emissions = display.kind === LINE_DISPLAY.COMPUTED ? rounded(display.tonnesCo2e, FIGURE_UNIT.TONNES) : null;
  const canExplain = display.kind === LINE_DISPLAY.COMPUTED;
  const period =
    entry === LINE_ENTRY.MONTHS && months !== null
      ? t('line.periodMonthly', {
          entered: (line.monthlyQuantities ?? []).filter((month) => month !== null).length,
          total: months.length,
        })
      : months !== null
        ? format.dateTimeRange(new Date(`${months[0]}-01T00:00:00Z`), new Date(`${months[months.length - 1]}-01T00:00:00Z`), {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : t('line.wholePeriod');

  return (
    <li className={styles.line} data-open={derivation.open ? '' : undefined}>
      <div className={styles.lineSource}>
        <p className={styles.sourceName}>{name}</p>
        <p className={styles.scope}>{source === undefined ? null : scopeName(source.ghgScope)}</p>
        {readOnly && line.description !== null ? <p className={styles.description}>{line.description}</p> : null}
      </div>

      <div className={styles.lineInvoice}>
        {entry === LINE_ENTRY.REASON ? (
          readOnly ? (
            <p>
              <span className={styles.noFigure}>{t('line.noFigure')}</span> {line.notAvailableReason}
            </p>
          ) : (
            <CommitArea
              key={line.notAvailableReason ?? ''}
              label={t('line.reason')}
              help={t('line.reasonHelp')}
              value={line.notAvailableReason ?? ''}
              onCommit={onReason}
            />
          )
        ) : entry === LINE_ENTRY.MONTHS && months !== null ? (
          // The twelve rows are the line's own row below; here, what they add up to, in the unit they are all in.
          <>
            <p className={styles.figureText}>
              {t('measure', { value: monthlyTotal === null ? '—' : typed(monthlyTotal), unit: unit === null ? '' : unitName(unit) })}
            </p>
            {readOnly || units.length < 2 ? null : <LineUnit units={units} unit={unit} onUnit={onUnit} />}
          </>
        ) : readOnly ? (
          <p className={styles.figureText}>
            {line.quantity === null ? null : t('measure', { value: typed(line.quantity), unit: line.unitCode === null ? '' : unitName(line.unitCode) })}
          </p>
        ) : (
          <LineFigure
            label={t('line.quantity')}
            quantity={line.notAvailableReason === null ? line.quantity : null}
            units={units}
            unit={unit}
            onQuantity={onQuantity}
            onUnit={onUnit}
          />
        )}
      </div>

      <div className={styles.lineResult}>
        <p>{converted}</p>
      </div>

      <div className={styles.lineResult}>
        <p className={styles.tonnes}>{emissions}</p>
        {line.overrideTonnes === null || emissions === null ? null : (
          <p className={styles.yours}>{t('override.yoursMarker')}</p>
        )}
        {canExplain ? (
          <Link
            className={styles.how}
            href={derivation.open ? derivation.closeHref : derivation.openHref}
            scroll={false}
            aria-expanded={derivation.open}
          >
            {derivation.open ? t('line.closeHow') : t('line.how')}
          </Link>
        ) : null}
      </div>

      <div className={styles.linePeriod}>
        <p>{period}</p>
        {sync === SAVE_STATE.SAVED ? null : <StatusChip tone={SYNC_TONE[sync]}>{tSync(SYNC_WORD[sync])}</StatusChip>}
      </div>

      {derivation.open &&
      canExplain &&
      source !== undefined &&
      result !== undefined &&
      line.quantity !== null &&
      line.unitCode !== null ? (
        <div className={styles.lineMonths}>
          <LineDerivation
            quantity={line.quantity}
            unit={line.unitCode}
            source={source}
            result={result}
            setLabel={computation.setLabel ?? ''}
            precision={computation.precision}
          />
        </div>
      ) : null}

      {entry === LINE_ENTRY.MONTHS && months !== null ? (
        <div className={styles.lineMonths}>
          <LineMonths
            source={name}
            months={months}
            values={line.monthlyQuantities}
            unit={unit === null ? null : unitName(unit)}
            readOnly={readOnly}
            onMonth={onMonth}
          />
        </div>
      ) : null}

      {canExplain && result !== undefined ? (
        <div className={styles.lineMonths}>
          <LineOverride
            substitute={
              line.overrideTonnes === null || line.overrideExplanation === null
                ? null
                : { tonnes: line.overrideTonnes, reason: line.overrideExplanation, by: line.overriddenBy?.name ?? null }
            }
            computed={rounded(result.computedTonnesCo2e ?? result.tonnesCo2e ?? '0', FIGURE_UNIT.TONNES)}
            readOnly={readOnly}
            onWrite={(override) => {
              save({
                ...fields,
                overrideTonnes: override?.tonnesCo2e ?? null,
                overrideExplanation: override?.explanation ?? null,
              });
            }}
          />
        </div>
      ) : null}

      {readOnly ? null : (
        <div className={styles.lineDetails}>
          <div className={styles.lineDescription}>
            <CommitField
              key={line.description ?? ''}
              label={t('line.description')}
              value={line.description ?? ''}
              onCommit={(draft) => save({ ...fields, description: draft.trim() === '' ? null : draft.trim() })}
            />
          </div>
          <div className={styles.lineActions}>
            {months === null || entry === LINE_ENTRY.REASON ? null : entry === LINE_ENTRY.MONTHS ? (
              <Button variant={BUTTON_VARIANT.SUBTLE} onClick={toAnnual}>
                {t('line.annual')}
              </Button>
            ) : (
              <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => setChosen(LINE_ENTRY.MONTHS)}>
                {t('line.monthly')}
              </Button>
            )}
            {entry === LINE_ENTRY.REASON ? (
              <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => setChosen(LINE_ENTRY.FIGURE)}>
                {t('line.measured')}
              </Button>
            ) : (
              <Button variant={BUTTON_VARIANT.SUBTLE} onClick={() => setChosen(LINE_ENTRY.REASON)}>
                {t('line.notAvailable')}
              </Button>
            )}
            <Button
              variant={BUTTON_VARIANT.SUBTLE}
              aria-label={t('line.removeLabel', { source: name })}
              onClick={() => change({ lineId: line.id, removed: true })}
            >
              {t('line.remove')}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** How a waiting line's marker paints, as the wizard's fields paint theirs. */
const SYNC_TONE: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, StatusTone>> = {
  [SAVE_STATE.QUEUED]: STATUS_TONE.PENDING,
  [SAVE_STATE.SAVING]: STATUS_TONE.PENDING,
  [SAVE_STATE.FAILED]: STATUS_TONE.ATTENTION,
};

/** The wizard's own words for the three, read from its namespace so one state has one name on both screens. */
const SYNC_WORD = {
  [SAVE_STATE.QUEUED]: 'queued',
  [SAVE_STATE.SAVING]: 'saving',
  [SAVE_STATE.FAILED]: 'failed',
} as const;
