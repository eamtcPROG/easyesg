'use client';

import {
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  isCalculatorFigure,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureState,
} from '@easyesg/contracts';
import {
  Button,
  BUTTON_VARIANT,
  DisclosureField,
  FIELD_TONE,
  SAVE_STATE,
  UnitLabel,
  type FieldTone,
  type SaveState,
} from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { decimalForReading } from '@/lib/decimal-input';
import { syncStateOf, writeKey } from '../../../tools/autosave-state';
import { fieldAnchor } from '../../../tools/field-anchor';
import { priorDraftOf, type PriorValue } from '../../../tools/comparatives';
import { unitWords } from '../../../tools/unit-words';
import { markerFor } from '../../../tools/field-marker';
import { TONE_OF_STATE } from '../../../tools/field-tone';
import {
  COLUMN_OF_KIND,
  confirmedWrite,
  notAvailableWrite,
  resumeWrite,
  storedDraftOf,
  unitOf,
  withCommitted,
  VALUE_COLUMN,
  writeFor,
} from '../../../tools/values';
import { HISTORY_SUBJECT } from '@/client/history/history-subject';
import { CalculatedFigure } from '@/features/calculator/components/figure/calculated-figure';
import { HistoryLink } from '@/features/history/components/trigger/history-link';
import { useAutosaveContext } from '../../providers/autosave-context';
import { useValidationContext } from '../../providers/validation-context';
import { DisclosureControl } from '../controls/disclosure-control';
import { NotAvailableDeclaration } from '../controls/not-available';
import { FIELD_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';
import { CarriedNote } from './carried-note';
import { FieldUnit } from './field-unit';
import { FindingMessages } from './finding-messages';

/**
 * One field of a step: §6.2's anatomy, its control, and — since task 91.4 — its unit.
 *
 * **A component rather than the closure this was, because a field now holds state of its own.**
 * UX-14's chosen unit is the reporter's answer and is not stored until a value is (the rule
 * `blankRow` states for an added row: *the store learns of it when a value does*), so it lives here
 * — and a `useState` cannot be called from inside a `.map`.
 *
 * **One `useState`, deliberately, and the reducer rule is why it is not more.** The unit is a single
 * value nothing else moves with: the control below owns the draft, this owns the unit, and the two
 * meet only in the write. `null` means *the reporter has not chosen*, which is different from a
 * stored `unitCode` and different again from the taxonomy's first admitted code — three sources
 * with a precedence rather than three states.
 */
export function StepField({
  reportId,
  served,
  named,
  readOnly,
  chosenUnit,
  onChooseUnit,
  prior,
}: {
  /** The report the field is of — what its change history is addressed by (task 84). */
  readonly reportId: string;
  readonly served: DisclosureFieldShape;
  readonly named?: string | null;
  readonly readOnly: boolean;
  /** The unit this field's ELEMENT is answered in, where the reporter has chosen one. */
  readonly chosenUnit: string | null;
  readonly onChooseUnit: (code: string) => void;
  /** Last year's comparable answer for this exact row, or `null` (FR-46). */
  readonly prior: PriorValue | null;
}) {
  const t = useTranslations(`${FIELD_MESSAGES}.sync`);
  const tField = useTranslations(FIELD_MESSAGES);
  const format = useFormatter();
  const tUnit = useTranslations(`${FIELD_MESSAGES}.units`);
  const tMarker = useTranslations(`${FIELD_MESSAGES}.markers`);
  // §6.4's word per state — read here since task 158, where the step's section built the same record on
  // the server from `getMessages()` and threaded it through `StepFields`. Literal keys, as `unitNames`
  // below, so a state the catalogue does not word fails `pnpm typecheck` rather than rendering an empty
  // marker. `ok` is the absence of a marker, so there is no word to read for it.
  const markerLabels: Readonly<Record<DisclosureState, string>> = {
    [DISCLOSURE_STATE.OK]: '',
    [DISCLOSURE_STATE.MISSING]: tMarker('missing'),
    [DISCLOSURE_STATE.INCONSISTENCY]: tMarker('inconsistency'),
    [DISCLOSURE_STATE.ERROR]: tMarker('error'),
    [DISCLOSURE_STATE.INVALID_URL]: tMarker('invalid_url'),
    [DISCLOSURE_STATE.NOT_AVAILABLE]: tMarker('not_available'),
    [DISCLOSURE_STATE.NOT_MATERIAL]: tMarker('not_material'),
    [DISCLOSURE_STATE.NIL_RETURN]: tMarker('nil_return'),
  };
  // Code to symbol, with literal keys so a missing symbol is a compile error (`tools/unit-words.ts`, shared since task
  // 95 with the kept-answer notice, which names the same units).
  const unitNames = unitWords(tUnit);
  const { state, change } = useAutosaveContext();
  const { findingsOf } = useValidationContext();

  const key = writeKey(served);
  // FR-40's verdicts at the point of entry (task 42.1): most severe first, so the first is the field's one state.
  const findings = findingsOf(key);
  const verdict = findings[0]?.verdict ?? null;
  const field = withCommitted(served, state.committed[key]);
  const unit = unitOf(field, chosenUnit);
  // The unit is part of the value, so the control writes with it rather than with what is stored.
  const withUnit: DisclosureFieldShape = { ...field, unitCode: unit };

  const sync = syncStateOf(state, key);
  // **A figure a calculator run wrote is not typed over** (task 39.3; UC-34, UX-43): the ordinary write refuses it
  // (§12.5.6's task-38.4 row (4)), so it takes the computed-figure control — replace with the reporter's figure and a
  // reason, explain it, or put the computed figure back — and none of the controls whose write the api would refuse.
  const calculatorFigure = isCalculatorFigure(field.elementKey) && field.origin !== DISCLOSURE_ORIGIN.REPORTED;
  const syncLabels: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, string>> = {
    [SAVE_STATE.QUEUED]: t('queued'),
    [SAVE_STATE.SAVING]: t('saving'),
    [SAVE_STATE.FAILED]: t('failed'),
  };
  const marker =
    sync === SAVE_STATE.SAVED
      ? markerFor({
          field,
          verdict,
          labels: markerLabels,
          provenance: {
            carried: tField('carried'),
            calculated: tField('calculated'),
            overridden: tField('overridden'),
            record: tField('fromRecord'),
          },
        })
      : { label: syncLabels[sync], tone: SYNC_TONE[sync] };
  // FR-47 item 4's confirm (task 191): offered on a carried value the reporter writes, once nothing of it is unsent — a
  // pending write sends the flag off already, so the mark is on its way out and the offer would be a second copy of it.
  const carriedNote =
    field.carriedForward && !readOnly && !calculatorFigure && sync === SAVE_STATE.SAVED ? (
      <CarriedNote onConfirm={() => change(confirmedWrite(field))} />
    ) : null;
  // Last year's answer in this field's own value column, or '' where it holds none there.
  const priorDraft = prior === null ? '' : priorDraftOf({ field, prior });
  // Shown as the reader reads a number, as the field beside it is (task 220; UX-96); carried as the stored decimal.
  const priorWords = COLUMN_OF_KIND[field.kind] === VALUE_COLUMN.NUMERIC ? decimalForReading({ value: priorDraft, format }) : priorDraft;
  const labelId = fieldAnchor(key);
  const label = named === undefined ? (field.label ?? tField('unnamed')) : (named ?? tField('unnamed'));

  return (
    <DisclosureField
      labelId={labelId}
      // Never the element key — the user-facing-text rule's own example (found by the convention
      // review, 3 Sep 2026, at two sites this task did not write and one it did).
      /*
       * **`named === null` is not `named === undefined`, and `??` collapsed them** (found by the
       * spec review). `undefined` means *this row is not a breakdown member, use the element's
       * label*; `null` means *this IS a member and the pinned version names it nothing*. Falling
       * through to the element label for the second gave three identically-named rows — the
       * exact reading this task exists to prevent, and what `wizard-step.model.ts` promises does
       * not happen: an unnamed member must render as an unnamed column, a visible defect rather
       * than a plausible-looking wrong word.
       */
      label={label}
      /*
       * **UX-30's statement is the omitted-disclosures element's own help since task 94** — *"the
       * interface shall say so at the point of entry"* — authored by the platform and held
       * platform-authored by the api's artefact spec, so a release that documents the element
       * cannot silently replace it. Until then this slot fell back to a notice of the screen's.
       */
      help={field.help}
      marker={marker?.label}
      markerTone={marker?.tone}
      // **Computed, not passed as an always-truthy element.** The anatomy renders
      // `{unit ? <NumberWithUnit unit={unit}>…</NumberWithUnit> : …}`, so a `<FieldUnit />` that returned
      // null would still lay out an empty box beside every text field — the slot has to be
      // `undefined`, which only the caller can decide. There is something to render when the
      // standard states a unit AND either one is in force or there is still a choice to offer.
      unit={
        // **The filing's currency, on a monetary field** (task 36.12). It takes UX-14's *fixed by
        // the taxonomy* branch — shown, never asked — because it is fixed by the **filing** rather
        // than chosen here: EFRAG's template carries one currency per workbook and `core.report`
        // pins it, so a chooser would offer a decision this screen does not own. Rendered as the
        // code itself, which is the reference a reader can cite (ISO 4217), never a symbol: `L`
        // reads as several currencies and `€` as none of Moldova's.
        field.currency !== null ? (
          <UnitLabel>{field.currency}</UnitLabel>
        ) : field.unitCodes.length > 0 && (unit !== null || (!readOnly && field.unitCodes.length > 1)) ? (
          <FieldUnit
            admitted={field.unitCodes}
            chosen={unit}
            readOnly={readOnly}
            label={tField('unitLabel')}
            placeholder={tField('choose')}
            nameOf={(code) => unitNames[code] ?? code}
            onChoose={onChooseUnit}
          />
        ) : undefined
      }
      /*
       * UX-31: *"adjacent to the current input at the point of entry, not in a separate comparison
       * view"* — §6.2's anatomy draws the row and `DisclosureField` has carried the slot unused
       * since it was built. Shown only where last year actually holds a figure in this kind's own
       * column: a field answered *not available* last year has a state and a reason and no value,
       * and *"Prior period:"* followed by nothing is worse than no row (task 36.14).
       */
      priorPeriod={priorDraft === '' ? undefined : tField('prior', { value: priorWords })}
      /*
       * FR-47 and UX-32's **per-field** action. The module-level bulk action that rule calls
       * *optional* is not built here and is named in `architecture.md` §12.5.6 — one action that
       * marks a whole module carried is the *accumulating unnoticed* this requirement exists to
       * prevent, and it wants its own review rather than a line in this one.
       *
       * Absent when the step is read-only, when there is nothing to copy, and when the field
       * already holds this year's answer — offering to overwrite an answer with last year's is a
       * different act from filling an empty field, and UC-46's trigger is *the Contributor judges
       * that a value has not changed*.
       */
      carryForward={
        readOnly || calculatorFigure || priorDraft === '' || storedDraftOf(field) !== '' ? undefined : (
          <Button
            variant={BUTTON_VARIANT.SUBTLE}
            onClick={() => change({ ...writeFor(field, priorDraft), carriedForward: true })}
          >
            {tField('carryForward')}
          </Button>
        )
      }
      message={
        // A finding first (task 42.1): its three parts are what the reader has to act on, and the same sentence S-08
        // shows for it. A declared gap holds no presence finding, so the two meet only where a declared field still
        // breaks a rule — and then the rule is the message.
        // A carried value's note follows a finding rather than giving way to it: the finding is what to act on, and the
        // confirm stays reachable for a value that is right while another field is not.
        verdict !== null ? (
          <>
            <FindingMessages findings={findings} />
            {carriedNote}
          </>
        ) : field.state === DISCLOSURE_STATE.NOT_AVAILABLE ? (
          // The artboard's line over the reason (task 179.2): it is not a note to self, a reader of the export sees it.
          <>
            <span className={styles.recorded}>{tField('notAvailable.recorded')}</span>
            {field.notAvailableReason}
          </>
        ) : (
          (carriedNote ?? undefined)
        )
      }
      // The carried note alone takes the tone the artboard tints it with; a declared gap keeps the reasoned one.
      messageTone={
        verdict !== null ? TONE_OF_STATE[verdict] : carriedNote !== null ? FIELD_TONE.OK : FIELD_TONE.REASONED
      }
      // **UX-15's declaration, live since task 36.5.** This slot carried `null` from task 35.2 with
      // task 36.13 named as its owner — the field-level half is built here for every module, and
      // UC-30's *section* exclusion remains 36.13's (a different act, with storage FR-31 has not
      // been given yet; `architecture.md` §12.5.6 records the split).
      notAvailable={
        // A computed figure is declared nothing: its absence is a run that measured nothing, which clears it (FR-30).
        calculatorFigure ? null : (
        <NotAvailableDeclaration
          declared={field.state === DISCLOSURE_STATE.NOT_AVAILABLE}
          onDeclare={(reason) => change(notAvailableWrite(field, reason))}
          onResume={() => change(resumeWrite(field))}
        />
        )
      }
      // S-12's way in (task 84; UX-68): where the field has changed, and for a reader who may read its trail — the link
      // draws nothing for anyone else. The count is the step read's, so it moves when the step is read again.
      history={
        served.changeCount > 0 ? (
          <HistoryLink
            count={served.changeCount}
            request={{
              subject: {
                kind: HISTORY_SUBJECT.VALUE,
                reportId,
                elementKey: served.elementKey,
                dimensionKey: served.dimensionKey,
                ordinal: served.ordinal,
              },
              naming: label,
            }}
          />
        ) : undefined
      }
      readOnly={readOnly}
    >
      {calculatorFigure ? (
        <CalculatedFigure field={field} readOnly={readOnly} />
      ) : (
        <DisclosureControl
          field={withUnit}
          readOnly={readOnly}
          labelledBy={labelId}
          // Said back with what a number was recorded as (task 221): the filing's currency, else the unit in force.
          unit={field.currency ?? (unit === null ? null : (unitNames[unit] ?? unit))}
          onCommit={change}
        />
      )}
    </DisclosureField>
  );
}


/** How a pending field paints: the cascade's pending role while it waits, error once it failed. */
const SYNC_TONE: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, FieldTone>> = {
  [SAVE_STATE.QUEUED]: FIELD_TONE.PENDING,
  [SAVE_STATE.SAVING]: FIELD_TONE.PENDING,
  [SAVE_STATE.FAILED]: FIELD_TONE.ERROR,
};
