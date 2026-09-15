'use client';

import {
  DISCLOSURE_STATE,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureState,
} from '@easyesg/contracts';
import {
  Button,
  BUTTON_VARIANT,
  DisclosureField,
  FIELD_TONE,
  SAVE_STATE,
  type FieldTone,
  type SaveState,
} from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { syncStateOf, writeKey } from '../../../tools/autosave-state';
import { priorDraftOf, type PriorValue } from '../../../tools/comparatives';
import { markerFor } from '../../../tools/field-marker';
import {
  notAvailableWrite,
  resumeWrite,
  storedDraftOf,
  unitOf,
  withCommitted,
  writeFor,
} from '../../../tools/values';
import { useAutosaveContext } from '../../providers/autosave-context';
import { DisclosureControl } from '../controls/disclosure-control';
import { NotAvailableDeclaration } from '../controls/not-available';
import { FIELD_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';
import { FieldUnit } from './field-unit';

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
  served,
  named,
  readOnly,
  chosenUnit,
  onChooseUnit,
  prior,
}: {
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
  // Code to symbol. Built with literal keys like `rowNames` in `section/step-fields.tsx`, so the catalogue lookup is
  // type-checked: `t(code)` is not, and a missing symbol would be a blank beside a number.
  const unitNames: Readonly<Record<string, string>> = {
    [UNIT_CODE.KILOGRAM]: tUnit('kg'),
    [UNIT_CODE.TONNE]: tUnit('t'),
    [UNIT_CODE.CUBIC_METRE]: tUnit('m3'),
    [UNIT_CODE.MEGAWATT_HOUR]: tUnit('MWh'),
    [UNIT_CODE.TONNE_CO2_EQUIVALENT]: tUnit('tCO2e'),
    [UNIT_CODE.HECTARE]: tUnit('ha'),
    [UNIT_CODE.SQUARE_KILOMETRE]: tUnit('sqkm'),
  };
  const { state, change } = useAutosaveContext();

  const key = writeKey(served);
  const field = withCommitted(served, state.committed[key]);
  const unit = unitOf(field, chosenUnit);
  // The unit is part of the value, so the control writes with it rather than with what is stored.
  const withUnit: DisclosureFieldShape = { ...field, unitCode: unit };

  const sync = syncStateOf(state, key);
  const syncLabels: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, string>> = {
    [SAVE_STATE.QUEUED]: t('queued'),
    [SAVE_STATE.SAVING]: t('saving'),
    [SAVE_STATE.FAILED]: t('failed'),
  };
  const marker =
    sync === SAVE_STATE.SAVED
      ? markerFor(field, markerLabels, { carried: tField('carried'), calculated: tField('calculated') })
      : { label: syncLabels[sync], tone: SYNC_TONE[sync] };
  // Last year's answer in this field's own value column, or '' where it holds none there.
  const priorDraft = prior === null ? '' : priorDraftOf({ field, prior });
  const labelId = labelIdFor(key);

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
      label={named === undefined ? (field.label ?? tField('unnamed')) : (named ?? tField('unnamed'))}
      /*
       * **UX-30, at the point of entry** (task 36.13): *"the declaration shall be presented as a
       * statement a third party will read in the export, and the interface shall say so"*. It rides
       * the `help` slot because UX-17 already puts one to two visible sentences there, which is
       * exactly the visibility UX-30 asks for — not a new affordance.
       *
       * **Keyed to one element, and that is the rule's own shape rather than a screen special
       * case**: UX-30 governs a single act, stating an omission under VSME ¶24(b), and the standard
       * gives it a single field. It is a *fallback*, so the day task 94 authors help for this
       * element EFRAG's own words win — the notice is this platform's, not a stand-in for the 121
       * missing texts that task owns.
       */
      help={field.help ?? (field.elementKey === OMITTED_DISCLOSURES_ELEMENT ? tField('omissionNotice') : null)}
      marker={marker?.label}
      markerTone={marker?.tone}
      // **Computed, not passed as an always-truthy element.** The anatomy renders
      // `{unit ? <div className={styles.unit}>…</div> : null}`, so a `<FieldUnit />` that returned
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
          <span className={styles.unit}>{field.currency}</span>
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
      priorPeriod={priorDraft === '' ? undefined : tField('prior', { value: priorDraft })}
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
        readOnly || priorDraft === '' || storedDraftOf(field) !== '' ? undefined : (
          <Button
            variant={BUTTON_VARIANT.SUBTLE}
            onClick={() => change({ ...writeFor(field, priorDraft), carriedForward: true })}
          >
            {tField('carryForward')}
          </Button>
        )
      }
      message={field.state === DISCLOSURE_STATE.NOT_AVAILABLE ? field.notAvailableReason : undefined}
      messageTone={FIELD_TONE.REASONED}
      // **UX-15's declaration, live since task 36.5.** This slot carried `null` from task 35.2 with
      // task 36.13 named as its owner — the field-level half is built here for every module, and
      // UC-30's *section* exclusion remains 36.13's (a different act, with storage FR-31 has not
      // been given yet; `architecture.md` §12.5.6 records the split).
      notAvailable={
        <NotAvailableDeclaration
          declared={field.state === DISCLOSURE_STATE.NOT_AVAILABLE}
          onDeclare={(reason) => change(notAvailableWrite(field, reason))}
          onResume={() => change(resumeWrite(field))}
        />
      }
      readOnly={readOnly}
    >
      <DisclosureControl field={withUnit} readOnly={readOnly} labelledBy={labelId} onCommit={change} />
    </DisclosureField>
  );
}

/**
 * The unit codes EFRAG's `measurementGuidance` admits across both registered versions (task 91.4).
 *
 * Declared here and unexported, exactly as `TYPED_AXIS` in `section/step-fields.tsx`: the values are the standard's own UTR
 * codes, used as **message keys** and never rendered — `sqkm` is an internal identifier and may not
 * reach a reader, so the symbols are catalogue content like every other string.
 *
 * **The code itself is the fallback**, and that is a decision rather than a shrug: a UTR code is a
 * *published* identifier a reader can look up — the user-facing-text rule's own exception for a
 * reference shown on purpose — while the alternative is a quantity with no unit at all, which is
 * the thing UX-14 exists to prevent. The extractor asserts this set, so a release adding an eighth
 * fails there rather than arriving here as a bare code.
 */
const UNIT_CODE = {
  KILOGRAM: 'kg',
  TONNE: 't',
  CUBIC_METRE: 'm3',
  MEGAWATT_HOUR: 'MWh',
  TONNE_CO2_EQUIVALENT: 'tCO2e',
  HECTARE: 'ha',
  SQUARE_KILOMETRE: 'sqkm',
} as const;

/**
 * VSME's omission is stated in this one field (¶24(b)), and UX-30 attaches a notice to it.
 * Named here rather than spelled at the site, per the closed-vocabulary rule.
 *
 * **A second declaration of the api's own** (`models/omission.model.ts`), and it is a mirror rather
 * than a duplicate for `DISCLOSURE_STATE`'s stated reason: the api produces `packages/contracts` and
 * must never import it, so nothing can hold the two together at compile time. What *does* hold them
 * is the browser journey — a screen naming a different element renders no notice and
 * `wizard.spec.ts`'s omission case fails on the missing text.
 */
const OMITTED_DISCLOSURES_ELEMENT =
  'ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation';

/** How a pending field paints: the cascade's pending role while it waits, error once it failed. */
const SYNC_TONE: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, FieldTone>> = {
  [SAVE_STATE.QUEUED]: FIELD_TONE.PENDING,
  [SAVE_STATE.SAVING]: FIELD_TONE.PENDING,
  [SAVE_STATE.FAILED]: FIELD_TONE.ERROR,
};

/** A stable, HTML-safe id from the natural key — element and member keys are XBRL names. */
const labelIdFor = (key: string): string => `disclosure-${key.replace(/[^A-Za-z0-9_-]/gu, '-')}`;
