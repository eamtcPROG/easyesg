'use client';

import {
  type DerivationInput,
  type DisclosureAxis,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureOption,
  type DisclosureState,
} from '@easyesg/contracts';
import { Button, BUTTON_VARIANT, Fieldset } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { writeKey } from '../../../tools/autosave-state';
import type { PriorValue } from '../../../tools/comparatives';
import {
  STEP_ENTRY,
  isLastClassificationRow,
  isLastRow,
  layOutStep,
  membersTaken,
  withAddedRows,
} from '../../../tools/step-layout';
import { outstandingDefaults, storedDraftOf, writeFor } from '../../../tools/values';
import { useAutosaveContext } from '../../providers/autosave-context';
import { DerivationInputControl } from '../field/derivation-input-control';
import { StepField } from '../field/step-field';
import { ClassificationRow } from '../rows/classification-row';
import { FIELD_MESSAGES, GROUP_MESSAGES, INPUT_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';

/**
 * A step's fields as §6.2's anatomy, bound to autosave (task 35.2) — the list task 35.1 rendered,
 * replaced by the component task 36.1 built for it.
 *
 * **The server-rendered field is overlaid with what the API has acknowledged since.** The step
 * arrives read once; each `FLUSH_SUCCEEDED` carries the rows as committed, and `withCommitted` is
 * how a field's marker moves from *missing* to nothing without a refetch — the same response that
 * moves the indicator to *saved*.
 *
 * **§4.10's per-field `synced | queued | failed` marker is derived from the same pending set** the
 * shell's indicator reads. A field whose key is pending shows *queued*, *saving* or *failed* in the
 * marker slot and outranks §6.4's validation marker while it does — the verdict on a value is not
 * known until the value is acknowledged. A field whose key is not pending is synced and shows its
 * stored state. One value, two indicators: the shell's answers for the step, this for the field.
 *
 * **The visible label is the control's programmatic label.** Each field gets a stable label id;
 * the control inside points `aria-labelledby` at it (UX-110's *visible, programmatically
 * associated* label, once), and the group reuses the same element for its own name.
 *
 * **`help` is the api's, and it is sparse.** EFRAG documents 22 of 143 elements (task 91.1, closing
 * OQ-59), so most fields carry `help: null` and the anatomy renders no sentence rather than a
 * paraphrase of the label. **`notAvailable` is passed as `null` on purpose**: UX-15's declaration
 * is UC-31, task 36.13's. The prop is *required* on the component so that passing nothing is a
 * decision a reader of this file can see, on `Callout`'s `action={null}` precedent — not a slot
 * that was forgotten.
 *
 * **Markers come from the catalogue by state**, resolved on the server and handed down as a record,
 * because a translator call cannot take a value the API supplies (S-13's page records the same
 * reason for legal forms).
 *
 * **A typed axis's rows are a `Fieldset` per ordinal, and the reporter may add one** (task 36.2).
 * Without the grouping a two-site B1 reads *Address of site, Address of site, City of site, City of
 * site* in the standard's own order, with nothing saying which belongs to which; without the add
 * control the group is read-only in a form, since the api serves the snapshot's rows and no more.
 * An added row lives here until something is typed into it — writing an empty row on the click
 * would leave a site nobody described in the store, to be met again on every later visit.
 *
 * **The step's shown defaults are committed on arrival** (FR-27, UX-34). The reporter who accepts
 * every pre-filled B1 value and moves on has filed them, which §12.5.6's task-91.2 row requires;
 * fields they actually touch commit on blur, and this covers the ones they never focus. *Arrival*
 * rather than departure because `useAutosave` mirrors its queue to the durable store in an effect
 * and deliberately fires nothing on unmount — a write enqueued there would reach neither.
 */
export function StepFields({
  fields,
  axes,
  derivationInputs,
  priorValues,
  readOnly,
  markerLabels,
  carriedLabel,
}: {
  readonly fields: readonly DisclosureFieldShape[];
  /**
   * The step's classification domains (task 36.5) — the rows a reporter may add, served once per
   * step because every element on an axis shares one list.
   */
  readonly axes: readonly DisclosureAxis[];
  /**
   * The values this step's derived figures are computed from (task 36.10; UC-26, UC-27). Empty for
   * every module EFRAG's own template computes no figure for.
   */
  readonly derivationInputs: readonly DerivationInput[];
  /** Last year's comparable answers, by §7.3's natural key (FR-46, UC-45; task 36.14). */
  readonly priorValues: ReadonlyMap<string, PriorValue>;
  readonly readOnly: boolean;
  /** §6.4's label per state, in the reader's language. `ok` carries no marker and is unused. */
  readonly markerLabels: Readonly<Record<DisclosureState, string>>;
  /** UX-32's "carried" mark, shown until the value is edited. */
  readonly carriedLabel: string;
}) {
  const tField = useTranslations(FIELD_MESSAGES);
  const tGroup = useTranslations(GROUP_MESSAGES);
  const tInput = useTranslations(INPUT_MESSAGES);
  // Only the defaults' commit is this component's business now; every per-field read moved to
  // `StepField` with the state it needs (task 91.4).
  const { change } = useAutosaveContext();

  // Axis to the word for one of its rows. Built like `markerLabels` on the page above — the
  // catalogue is indexed by a literal, and an axis it does not name gets a neutral word rather than
  // a taxonomy identifier on a screen.
  const rowNames: Readonly<Record<string, string>> = {
    [TYPED_AXIS.SITE]: tGroup('names.IdentifierOfSiteTypedAxis'),
    [TYPED_AXIS.SUBSIDIARY]: tGroup('names.IdentifierOfSubsidiaryTypedAxis'),
    [TYPED_AXIS.MATERIAL]: tGroup('names.IdentifierOfMaterialTypedAxis'),
    // **A classification is named by its own domain where EFRAG names one, and only otherwise from
    // here** (task 36.8). B4's pollutant axis has a default member, so the api answers *Tipul de
    // poluant* from the member catalogue and this entry is never reached for it. The waste axis has
    // none — its domain root is in neither the members map nor any catalogue — so the name comes
    // from the workbook's own column header, *Type of waste*, authored in three locales here rather
    // than hand-edited into a members catalogue the extractor regenerates.
    [CLASSIFICATION_AXIS.WASTE]: tGroup('names.TypeOfWasteAxis'),
    // B8's, and its default member is unworded too — so the name is EFRAG's own column header
    // again rather than anything the package resolves (task 36.9).
    [CLASSIFICATION_AXIS.COUNTRY]: tGroup('names.CountryOfEmploymentContractAxis'),
  };

  // How many rows the reporter has added to each axis beyond the ones the api served. One value
  // nothing else moves with, which is the case the reducer rule leaves to a single `useState`.
  const [added, setAdded] = useState<Readonly<Record<string, number>>>({});

  /**
   * The derivation inputs' wording, by **literal** key so the catalogue lookup is type-checked.
   *
   * **This was `tInput(`names.${input.key}` as never)` until 9 Sep 2026** (convention review at task
   * 36's parent close), which is the shape this file forbids twice in its own docblocks — for
   * `rowNames` and for `unitNames` — and had then declined for the case where it matters most.
   * `config/seed/disclosure-derivation.vsme.json` is publishable data under DR-3, so a fifth
   * derivation published with a new input key rendered a field with a **blank label and blank help**
   * and every gate green; the `as never` is precisely what turned the compile error into that blank.
   *
   * A key with no wording now falls back to the neutral word, as `rowNames` does — visible, rather
   * than an unlabelled box.
   */
  const inputWords: Readonly<Record<string, { label: string; help: string }>> = {
    AverageGrossHourlyPayLevelOfFemaleEmployees: { label: tInput('names.AverageGrossHourlyPayLevelOfFemaleEmployees'), help: tInput('help.AverageGrossHourlyPayLevelOfFemaleEmployees') },
    AverageGrossHourlyPayLevelOfMaleEmployees: { label: tInput('names.AverageGrossHourlyPayLevelOfMaleEmployees'), help: tInput('help.AverageGrossHourlyPayLevelOfMaleEmployees') },
    HoursWorkedByOneFullTimeEmployee: { label: tInput('names.HoursWorkedByOneFullTimeEmployee'), help: tInput('help.HoursWorkedByOneFullTimeEmployee') },
    NumberOfEmployeesAtTheBeginningOfTheReportingPeriod: { label: tInput('names.NumberOfEmployeesAtTheBeginningOfTheReportingPeriod'), help: tInput('help.NumberOfEmployeesAtTheBeginningOfTheReportingPeriod') },
    NumberOfEmployeesAtTheEndOfTheReportingPeriod: { label: tInput('names.NumberOfEmployeesAtTheEndOfTheReportingPeriod'), help: tInput('help.NumberOfEmployeesAtTheEndOfTheReportingPeriod') },
    NumberOfEmployeesCoveredByCollectiveBargainingAgreements: { label: tInput('names.NumberOfEmployeesCoveredByCollectiveBargainingAgreements'), help: tInput('help.NumberOfEmployeesCoveredByCollectiveBargainingAgreements') },
    NumberOfEmployeesWhoLeftDuringTheReportingPeriod: { label: tInput('names.NumberOfEmployeesWhoLeftDuringTheReportingPeriod'), help: tInput('help.NumberOfEmployeesWhoLeftDuringTheReportingPeriod') },
  };

  /**
   * The fields this reporter is actually asked (FR-28; task 36.9).
   *
   * **§7.3's third condition, which nothing implemented**: *"Not applicable — **Not rendered**. The
   * system never renders a field and then refuses its value on grounds it already knew (P2)."* Until
   * this task only the *module* carried the verdict, on the rail, so B8's turnover was shown to a
   * ten-employee company and B10's pay gap to everyone. Task 95's own row assumed the behaviour
   * already existed — *"a conditional field simply appears and disappears between step reads"* — and
   * owns **announcing** the change, which is still its.
   *
   * **`applicable` alone, and UX-28 is not an exception to it** (convention review, 9 Sep 2026 —
   * this filter shipped with one, on a misreading of the rule it cited). UX-28 reads *"where a
   * conditional field **disappears** after being answered, the entered value shall be retained and
   * **restored if the condition returns**"*: it presupposes the disappearance and asks that the
   * **value** survive it, which is storage and the wire rather than the screen. §12.5.6's task-91.3
   * row already settled where that retention lives — *"retained and returned, marked by
   * `applicable: false` beside a state that is not `missing`"* — and keeping the field on screen
   * would contradict §7.3 in the same breath as implementing it, leaving a reporter editing a
   * question the standard does not ask their undertaking while the module's outstanding count, which
   * the api computes over applicable elements only, disagreed with the screen permanently.
   */
  const asked = useMemo(() => fields.filter((field) => field.applicable), [fields]);

  /**
   * The elements this step *derives*, which the reporter does not type (FR-29; task 36.10).
   *
   * **Read off the inputs rather than off a flag on the field**, so the two cannot disagree: a
   * figure is derived exactly when something is registered as feeding it, and that is the same fact
   * the api refuses a write against. A field marked derived with nothing feeding it would render
   * permanently read-only and permanently empty.
   */
  const derived = useMemo(
    () => new Set(derivationInputs.map((input) => input.derives)),
    [derivationInputs],
  );

  /**
   * The inputs actually worth asking — those feeding a figure this reporter is asked for
   * (FR-28, BR-APP-5; found by the B8 browser journey, 9 Sep 2026).
   *
   * **An input outlives nothing.** B8's three turnover figures exist only to produce
   * `EmployeeTurnoverRate`, which applies at fifty employees; below it, asking a ten-person
   * undertaking how many people left in the period is asking a question whose only answer is a
   * disclosure they do not make. `asked` already carries the api's applicability verdict, so this
   * is that same verdict followed one step further rather than a second rule.
   *
   * **Not filtered in the api**, deliberately: the step serves what the artefact registers, and
   * *shown or not* is the same screen decision `asked` is — one place, one rule.
   */
  const askedInputs = useMemo(() => {
    const applicable = new Set(asked.map((field) => field.elementKey));
    return derivationInputs.filter((input) => applicable.has(input.derives));
  }, [derivationInputs, asked]);

  // Once per step, and guarded by a ref rather than by its dependency list: `fields` is a new array
  // on every render of the server component above — so `asked` is too, and the list alone would
  // re-fire and re-queue writes the store has already acknowledged. The list still names what the
  // body reads, because a list that omits a value it uses is the one shape no reader can check.
  const committedDefaults = useRef(false);
  useEffect(() => {
    if (committedDefaults.current || readOnly) return;
    committedDefaults.current = true;
    // **`asked`, not `fields`** (convention review, 9 Sep 2026): a default committed for a field
    // the reporter is not shown is an answer filed for a question never displayed — the same rule
    // the filter above applies, one commit path over. Latent today, since no element carrying an
    // applicability rule carries an entity default; live the day one does.
    for (const write of outstandingDefaults(asked)) change(write);
  }, [asked, readOnly, change]);

  // **Memoized deliberately, and this is one of the three cases `apps/web/CLAUDE.md` says bite with
  // `reactCompiler` off** — grouping a list, recomputed per render. This component re-renders on
  // every autosave transition (the context), while `fields` and `added` move only when the server
  // re-renders or a row is added, so the grouping ran on every keystroke's acknowledgement.
  const classificationAxes = useMemo(() => new Set(axes.map((axis) => axis.key)), [axes]);

  const entries = useMemo(
    () => withAddedRows(layOutStep(asked, classificationAxes), added),
    [asked, classificationAxes, added],
  );

  // **Built once here rather than per row in the JSX** (convention review, 8 Sep 2026). Called
  // inline, `membersTaken` returns a fresh `Set` on every render — so it would defeat the very
  // `useMemo` in `MemberPicker` that exists because this component re-renders on every autosave
  // transition, and it walks every entry per classification row while doing so. Both bullets of
  // `apps/web/CLAUDE.md`'s manual-memoization list, in one prop.
  const takenByAxis = useMemo(
    () => new Map(axes.map((axis) => [axis.key, membersTaken(entries, axis.key)])),
    [axes, entries],
  );

  /**
   * Each classification's members indexed by value, built once for the step (convention review,
   * 8 Sep 2026).
   *
   * `ClassificationRow` needs its own member to write a legend, and a `find` there is a linear scan
   * **per row per render** — of 94 pollutants before task 36.8 and of **842 waste entries** after
   * it, while this component re-renders on every autosave transition. That is `js-index-maps`
   * exactly, and the same argument `takenByAxis` above was memoized for.
   */
  const membersByAxis = useMemo(
    () => new Map(axes.map((axis) => [axis.key, new Map(axis.members.map((m) => [m.value, m]))])),
    [axes],
  );

  /**
   * The unit each **element** is answered in, where the reporter has chosen one (task 91.4, scoped
   * per element by the project owner on 8 Sep 2026 after the spec review).
   *
   * **Per element rather than per row**, which is what EFRAG's own template says: its B4 unit cell
   * is `C78:K78` — one merged cell over all three amount columns and every pollutant row. Held per
   * row, one filing could carry ammonia in kilogrammes beside asbestos in tonnes down a single
   * column, which is the unusable data UX-14 exists to prevent. The taxonomy's granularity is the
   * element too: B7 admits `[utr:kg,utr:t]` on one waste figure and `[utr:kg]` on its neighbour, so
   * a per-*table* unit is not expressible while a per-element one always is.
   *
   * Every row's control edits the same value, so a number keeps its unit beside it and there is
   * still only one unit to be wrong about.
   */
  const [units, setUnits] = useState<Readonly<Record<string, string>>>({});

  /**
   * A unit change re-commits **every stored row of that element**, not the row it was clicked in.
   *
   * 12 kg and 12 t are different facts, so rows already written have to move with the choice — and
   * a row nobody has answered has nothing to write, exactly as an added row does not.
   */
  const chooseUnit = (elementKey: string, next: string) => {
    setUnits((chosen) => ({ ...chosen, [elementKey]: next }));
    for (const field of fields) {
      if (field.elementKey !== elementKey) continue;
      const stored = storedDraftOf(field);
      if (stored !== '') change(writeFor({ ...field, unitCode: next }, stored));
    }
  };

  return (
    <div className={styles.fields}>
      {entries.map((entry) =>
        entry.kind === STEP_ENTRY.GROUP ? (
          <Fieldset
            key={`${entry.axis} ${entry.ordinal}`}
            legend={groupLegend(tGroup, {
              name: rowNames[entry.axis] ?? tGroup('fallbackName'),
              position: entry.ordinal + 1,
              // What the report itself calls this row — B1's address or city for the site B5 is
              // asking about (task 36.6). Every field of a group shares an ordinal, so they share
              // the name; `null` where nothing has described it yet, and the position still says
              // which row it is.
              given: entry.fields[0]?.dimensionLabel ?? null,
            })}
            readOnly={readOnly}
            action={
              isLastRow(entries, entry) ? (
                <Button
                  variant={BUTTON_VARIANT.SUBTLE}
                  type="button"
                  onClick={() =>
                    setAdded((rows) => ({ ...rows, [entry.axis]: (rows[entry.axis] ?? 0) + 1 }))
                  }
                >
                  {tGroup('add')}
                </Button>
              ) : undefined
            }
          >
            {entry.fields.map((field) => renderField(field))}
          </Fieldset>
        ) : entry.kind === STEP_ENTRY.BREAKDOWN ? (
          /*
           * A breakdown (task 36.4) — **the same `Fieldset`, and no inventory addition**. UX-89's
           * test for one is a difference in *anatomy*, and there is none: a legend over a set of
           * related fields is what this control is. What differs is content — the legend names the
           * element instead of a position, each row is named by its member instead of by its own
           * element, and nothing is added, because the standard fixes the members.
           */
          <Fieldset
            key={entry.elementKey}
            legend={entry.fields[0]?.label ?? tField('unnamed')}
            readOnly={readOnly}
          >
            {entry.fields.map((field) => renderField(field, field.dimensionLabel))}
          </Fieldset>
        ) : entry.kind === STEP_ENTRY.CLASSIFICATION ? (
          /*
           * A classification row (task 36.5) — **the same `Fieldset` again**, and for the third
           * time no inventory addition: a legend over a set of related fields is what this control
           * is, and UX-89's test is a difference in *anatomy*. What differs is that the legend is
           * chosen rather than given, so the picker sits inside the group it names.
           */
          <ClassificationRow
            key={`${entry.axis} ${entry.dimensionKey}`}
            entry={entry}
            domain={axisOf(entry.axis)}
            axisNames={rowNames}
            byValue={membersByAxis.get(entry.axis) ?? NO_MEMBERS_BY_VALUE}
            taken={takenByAxis.get(entry.axis) ?? NO_MEMBERS}
            readOnly={readOnly}
            action={
              isLastClassificationRow(entries, entry) && !readOnly ? (
                <Button
                  variant={BUTTON_VARIANT.SUBTLE}
                  type="button"
                  onClick={() =>
                    setAdded((rows) => ({ ...rows, [entry.axis]: (rows[entry.axis] ?? 0) + 1 }))
                  }
                >
                  {tGroup('addRow')}
                </Button>
              ) : undefined
            }
            renderField={renderField}
          />
        ) : (
          renderField(entry.field)
        ),
      )}
      {/*
        The values the step's derived figures are computed from (UC-26 step 4, UC-27 step 2), after
        the fields rather than among them: EFRAG's own template puts them under the figure they feed,
        and they are not disclosures — putting them in `entries` would mean every reader of that list
        excluding them. `DerivationInputControl` reuses `DisclosureField` rather than adding to the
        inventory, the anatomy being identical (UX-89).
      */}
      {askedInputs.map((input) => (
        <DerivationInputControl
          key={input.key}
          input={input}
          readOnly={readOnly}
          label={inputWords[input.key]?.label ?? tField('unnamed')}
          help={inputWords[input.key]?.help ?? ''}
        />
      ))}
    </div>
  );

  /** The domain a classification row picks from — served once per step, never per field. */
  function axisOf(axis: string): DisclosureAxis | undefined {
    return axes.find((candidate) => candidate.key === axis);
  }

  /**
   * @param named what to call this field, where the row's own name is not the element's — a
   *   breakdown's member. `undefined` everywhere else, so every other caller is unchanged.
   */
  function renderField(served: DisclosureFieldShape, named?: string | null) {
    return (
      <StepField
        key={writeKey(served)}
        served={served}
        named={named}
        // **A derived figure is read-only even on an editable step** (FR-29, task 36.10). The api
        // refuses a write to one, so an input here would be a control whose every use is rejected;
        // UX-13's own rule is that read-only keeps the layout and removes the affordance, which is
        // exactly what a computed figure wants — it is shown, beside the values it came from.
        readOnly={readOnly || derived.has(served.elementKey)}
        markerLabels={markerLabels}
        carriedLabel={carriedLabel}
        chosenUnit={units[served.elementKey] ?? null}
        onChooseUnit={(code) => chooseUnit(served.elementKey, code)}
        prior={priorValues.get(writeKey(served)) ?? null}
      />
    );
  }
}

/**
 * A repeating group's legend: *Amplasament 2* where nothing names the row, *Amplasament 2 — Orhei*
 * where the report does (task 36.6).
 *
 * **The position stays either way**, which is what makes a repeated name usable: two sites in one
 * city are *Amplasament 1 — Orhei* and *Amplasament 2 — Orhei*, and the ordinal is the identity
 * §7.3 actually keys on. The name only helps a reader tell them apart.
 *
 * Two catalogue keys rather than one with an empty argument, because a message with a dangling
 * separator is a message the translator cannot fix.
 */
function groupLegend(
  t: ReturnType<typeof useTranslations<typeof GROUP_MESSAGES>>,
  row: { readonly name: string; readonly position: number; readonly given: string | null },
): string {
  return row.given === null
    ? t('legend', { name: row.name, position: row.position })
    : t('legendNamed', { name: row.name, position: row.position, given: row.given });
}

/** No row of this axis names a member yet. Module-level, so it is one identity rather than many. */
const NO_MEMBERS: ReadonlySet<string> = new Set();

/** An axis the step serves no domain for. Module-level for `NO_MEMBERS`' reason. */
const NO_MEMBERS_BY_VALUE: ReadonlyMap<string, DisclosureOption> = new Map();

/**
 * The classification axes this product has to name itself — the ones EFRAG's package words nowhere.
 *
 * Declared beside `TYPED_AXIS` and for its reasons: the value is EFRAG's axis key, used as a
 * **message key** and never rendered, written out so the catalogue lookup is type-checked.
 */
const CLASSIFICATION_AXIS = {
  WASTE: 'TypeOfWasteAxis',
  COUNTRY: 'CountryOfEmploymentContractAxis',
} as const;

/**
 * The typed axes this product names a row of — B1's two and B7's, at `2026-05-01`.
 *
 * Declared here and unexported, because it is internal to this file (CLAUDE.md): the values are
 * EFRAG's axis keys, used as **message keys** and never rendered, and the literals are written out
 * so the catalogue lookup is type-checked. A dynamic `t(\`names.${axis}\`)` is not — next-intl's
 * translator takes a key from the catalogue's own shape, which is exactly the property that makes a
 * missing string a compile error here rather than a blank on a screen.
 */
const TYPED_AXIS = {
  SITE: 'IdentifierOfSiteTypedAxis',
  SUBSIDIARY: 'IdentifierOfSubsidiaryTypedAxis',
  MATERIAL: 'IdentifierOfMaterialTypedAxis',
} as const;
