'use client';

import {
  type DerivationInputWrite,
  type DerivationInput,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureAxis,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureOption,
  type DisclosureState,
} from '@easyesg/contracts';
import {
  Button,
  BUTTON_VARIANT,
  DisclosureField,
  Fieldset,
  FIELD_TONE,
  SAVE_STATE,
  Select,
  type FieldTone,
  type SaveState,
  TextField,
} from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TONE_OF_STATE, hasMarker } from '../field-tone';
import { syncStateOf, writeKey } from '../autosave-state';
import {
  STEP_ENTRY,
  isLastClassificationRow,
  isLastRow,
  layOutStep,
  membersTaken,
  withAddedRows,
  type StepClassificationEntry,
} from '../step-layout';
import {
  notAvailableWrite,
  outstandingDefaults,
  resumeWrite,
  storedDraftOf,
  unitOf,
  withCommitted,
  writeFor,
  parseDecimalInput,
} from '../values';
import { useAutosaveContext } from './autosave-context';
import { DisclosureControl } from './disclosure-control';
import { MemberPicker, memberName } from './member-picker';
import { NotAvailableDeclaration } from './not-available';
import styles from './step.module.css';

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
   * every module but B8 and B9 — the two EFRAG's own template computes a figure for.
   */
  readonly derivationInputs: readonly DerivationInput[];
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
          label={tInput(`names.${input.key}` as never)}
          help={tInput(`help.${input.key}` as never)}
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
      />
    );
  }
}

/**
 * One row of a classification: the member it reports, and every element reported for it (task 36.5).
 *
 * **A component rather than a branch, because a row that has no member yet holds the choice.** The
 * api serves a row per member the report already names plus one unassigned row; the reporter picks
 * a pollutant here, and nothing is written until a *value* follows — `blankRow`'s own rule, and the
 * reason the picked member is state rather than a write of its own. An empty row in the store would
 * be met on every later visit by whoever never finished filling it in.
 *
 * **One `useState`**, per the reducer rule: the chosen member is one value nothing else moves with.
 * The cells' drafts belong to their own controls, and they meet only in the key each write carries.
 */
function ClassificationRow({
  entry,
  domain,
  axisNames,
  byValue,
  taken,
  readOnly,
  action,
  renderField,
}: {
  readonly entry: StepClassificationEntry;
  readonly domain: DisclosureAxis | undefined;
  /** What this app calls each axis, for the ones EFRAG's package words nowhere. */
  readonly axisNames: Readonly<Record<string, string>>;
  /**
   * The axis's members indexed by value, built once for the step.
   *
   * **The index rather than the resolved member**, because the row's member is not always
   * `entry.dimensionKey`: a member the reporter has just picked lives in this component's own state
   * until a value is written under it, so the parent cannot resolve it. Passing the pre-resolved
   * member made a just-chosen waste entry render *unnamed* — caught by the browser journey.
   */
  readonly byValue: ReadonlyMap<string, DisclosureOption>;
  readonly taken: ReadonlySet<string>;
  readonly readOnly: boolean;
  readonly action: ReactNode;
  readonly renderField: (field: DisclosureFieldShape, named?: string | null) => ReactNode;
}) {
  const tGroup = useTranslations(GROUP_MESSAGES);
  const tField = useTranslations(FIELD_MESSAGES);

  // The reporter's choice for a row the server served without one. `null` means *not chosen here*,
  // which is not the same as the server's `''` — a row the server DID key stays keyed.
  const [picked, setPicked] = useState<string | null>(null);

  // What to call the axis: its own domain's name where EFRAG publishes one, this app's otherwise,
  // and a neutral word if neither — never the axis key, which is an XBRL identifier.
  const axisName = domain?.label ?? axisNames[entry.axis] ?? tGroup('fallbackName');
  const member = entry.dimensionKey !== '' ? entry.dimensionKey : (picked ?? '');

  // **The legend names the member, never the axis key.** A member the pinned version words in no
  // locale falls back to a neutral word, on `renderField`'s own rule: an XBRL name may not reach a
  // reader, and an unnamed row is a visible defect rather than a plausible-looking wrong word.
  const legend =
    member === ''
      ? tGroup('unassignedRow', { name: axisName })
      : memberName(byValue.get(member), tField('unnamed'));

  return (
    <Fieldset
      // **The legend is marked too, not just the listbox** (WCAG 2.2 SC 3.1.2): once a member is
      // chosen its name IS the group's accessible name, so an English waste entry would otherwise
      // be announced as Romanian by the document's own `lang`. `Fieldset.legend` is a `ReactNode`,
      // which is what makes this one span rather than a prop on the component.
      legend={
        domain?.memberLanguage === null || domain === undefined || member === '' ? (
          legend
        ) : (
          <span lang={domain.memberLanguage}>{legend}</span>
        )
      }
      readOnly={readOnly}
      action={action}
    >
      {/* The picker only where the row has no member yet: once a value is stored under one, moving
          it would leave the old key's answers behind under a pollutant nobody reports. Changing an
          unanswered row costs nothing, which is why the choice stays open until then. */}
      {!readOnly && entry.dimensionKey === '' && domain !== undefined ? (
        <MemberPicker
          members={domain.members}
          chosen={member}
          taken={taken}
          onChoose={setPicked}
          // WCAG 2.2 SC 3.1.2: the api answers which language the names are in, so the listbox is
          // marked rather than left for a screen reader to pronounce as Romanian (task 36.8).
          memberLang={domain.memberLanguage}
          labels={{
            label: axisName,
            placeholder: tField('choose'),
            prompt: tField('choicePrompt'),
            empty: tField('choiceEmpty'),
            loading: tField('choiceLoading'),
            unnamed: tField('unnamed'),
            hazardous: tGroup('hazardous'),
            nonHazardous: tGroup('nonHazardous'),
            // **The wire decides whether to say it, and the catalogue says what** (task 36.8).
            // `memberLanguage` is `null` wherever the names are in the reader's own — B4's
            // pollutants are worded in the catalogues — so the note appears only where a domain is
            // published in a language the reader did not ask for, and stops appearing on its own
            // the day one is translated.
            language: domain.memberLanguage === null ? null : tGroup('domainLanguage'),
          }}
        />
      ) : null}
      {/*
       * **The cells appear once the row is named, and that is a correctness rule before it is a
       * design one.** §7.3 keys a value by `(element, dimension, ordinal)`, and the step read
       * collects a classification's rows from the members a report *holds* — so an amount written
       * while `dimensionKey` is `''` would be stored under the undimensioned key and never read
       * back: a live row under a key nothing looks at, which is exactly the defect the typed facade
       * exists to prevent one layer down.
       *
       * It also matches the order EFRAG's own sheet asks in — `Row ID │ Pollutant │ air │ water │
       * soil`, filled left to right — so the reporter is never asked *how much* before *of what*.
       *
       * **The member reaches each cell through its own key**, so a row the reporter has just named
       * writes to that member rather than to the row the server served unassigned.
       */}
      {member === ''
        ? null
        : entry.fields.map((field) => renderField({ ...field, dimensionKey: member }))}
    </Fieldset>
  );
}

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
function StepField({
  served,
  named,
  readOnly,
  markerLabels,
  carriedLabel,
  chosenUnit,
  onChooseUnit,
}: {
  readonly served: DisclosureFieldShape;
  readonly named?: string | null;
  readonly readOnly: boolean;
  readonly markerLabels: Readonly<Record<DisclosureState, string>>;
  readonly carriedLabel: string;
  /** The unit this field's ELEMENT is answered in, where the reporter has chosen one. */
  readonly chosenUnit: string | null;
  readonly onChooseUnit: (code: string) => void;
}) {
  const t = useTranslations(`${FIELD_MESSAGES}.sync`);
  const tField = useTranslations(FIELD_MESSAGES);
  const tUnit = useTranslations(`${FIELD_MESSAGES}.units`);
  // Code to symbol. Built with literal keys like `rowNames` above, so the catalogue lookup is
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
      ? markerFor(field, markerLabels, { carried: carriedLabel, calculated: tField('calculated') })
      : { label: syncLabels[sync], tone: SYNC_TONE[sync] };
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
          labels={{
            declare: tField('notAvailable.declare'),
            reason: tField('notAvailable.reason'),
            reasonHelp: tField('notAvailable.reasonHelp'),
            confirm: tField('notAvailable.confirm'),
            cancel: tField('notAvailable.cancel'),
            resume: tField('notAvailable.resume'),
          }}
        />
      }
      readOnly={readOnly}
    >
      <DisclosureControl field={withUnit} readOnly={readOnly} labelledBy={labelId} onCommit={change} />
    </DisclosureField>
  );
}


/**
 * UX-14's unit, in the anatomy's own slot: *"either fixed by the taxonomy or chosen from a
 * constrained list"* (task 91.4).
 *
 * **The two branches are `length`, not a flag** — one admitted code is a unit to show, several are a
 * list to ask from — and neither is free text, which UX-14 calls *"the primary source of unusable
 * ESG data"*. **No inventory addition**: `DisclosureField`'s `unit` slot is documented as taking
 * *"a fixed label or a constrained control"*, and the control is `Select` off the shelf, so UX-89's
 * test — a difference in **anatomy** — finds none.
 */
function FieldUnit({
  admitted,
  chosen,
  readOnly,
  label,
  placeholder,
  nameOf,
  onChoose,
}: {
  readonly admitted: readonly string[];
  /** The unit in force, or `null` where several are admitted and nobody has chosen yet. */
  readonly chosen: string | null;
  readonly readOnly: boolean;
  readonly label: string;
  readonly placeholder: string;
  readonly nameOf: (code: string) => string;
  readonly onChoose: (code: string) => void;
}) {
  // One admitted unit is UX-14's *fixed by the taxonomy*: shown, never asked. Read-only takes the
  // same branch — UX-13 keeps the layout and removes the affordance.
  if (readOnly || admitted.length < 2) {
    return chosen === null ? null : <span className={styles.unit}>{nameOf(chosen)}</span>;
  }
  return (
    <Select
      label={label}
      labelHidden
      // **Empty until chosen** (project owner, 8 Sep 2026). `unitCodes` is not an order of
      // preference — EFRAG's own template pre-selects tonnes where the taxonomy lists kilogrammes
      // first — so a seeded value here would file a unit nobody picked, at a thousandfold error.
      placeholder={placeholder}
      value={chosen ?? undefined}
      onValueChange={onChoose}
      options={admitted.map((code) => ({ value: code, label: nameOf(code) }))}
    />
  );
}

/**
 * The unit codes EFRAG's `measurementGuidance` admits across both registered versions (task 91.4).
 *
 * Declared here and unexported, exactly as `TYPED_AXIS` below: the values are the standard's own UTR
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
 * The catalogue namespaces this file reads, declared once because three components read them.
 *
 * `as const` so next-intl still type-checks the keys against the catalogue's shape — the property
 * that makes a missing string a compile error here rather than a blank on a screen, and the reason
 * `TYPED_AXIS` below spells its axis keys out.
 */
const FIELD_MESSAGES = 'organization.wizard.field' as const;
const GROUP_MESSAGES = 'organization.wizard.group' as const;
/** The derivation inputs' own wording — EFRAG words these in the template, not the taxonomy. */
const INPUT_MESSAGES = 'organization.wizard.derivationInput' as const;
/**
 * VSME's omission is stated in this one field (¶24(b)), and UX-30 attaches a notice to it.
 * Named here rather than spelled at the site, per the closed-vocabulary rule.
 */
const OMITTED_DISCLOSURES_ELEMENT =
  'ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation';

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

/** How a pending field paints: the cascade's pending role while it waits, error once it failed. */
const SYNC_TONE: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, FieldTone>> = {
  [SAVE_STATE.QUEUED]: FIELD_TONE.PENDING,
  [SAVE_STATE.SAVING]: FIELD_TONE.PENDING,
  [SAVE_STATE.FAILED]: FIELD_TONE.ERROR,
};

/** A stable, HTML-safe id from the natural key — element and member keys are XBRL names. */
const labelIdFor = (key: string): string => `disclosure-${key.replace(/[^A-Za-z0-9_-]/gu, '-')}`;

/**
 * What the field says about itself, where it has something to say.
 *
 * **Origin is read first, and it is the one marker about where a figure CAME FROM** rather than
 * about its state (task 36.4). UC-21's alternate flow makes B3's figures *"normally produced by
 * the carbon calculator rather than typed directly"*, and UX-12 hangs a provenance mark off exactly this
 * distinction — a trace can only be offered for a figure the system computed.
 *
 * **`calculated` cannot occur yet, and that is recorded rather than hidden.** Nothing writes it
 * until task 39.2's return from the calculator, so this branch is unreachable on today's data. It
 * is here because the marker is the seam 39.2 writes into; `architecture.md` §12.5.6 carries the
 * decision and the cost. `overridden` is deliberately NOT marked here — UX-43 requires an override
 * to display the superseded value beside the substituted one and to carry a reason, which is a
 * component and not a word, and it belongs to task 38.5 that produces it.
 */
function markerFor(
  field: DisclosureFieldShape,
  labels: Readonly<Record<DisclosureState, string>>,
  // Named rather than two adjacent `string`s, per the root CLAUDE.md: swapped, the call compiles
  // and every calculated figure reads *carried forward* — a plausible wrong answer, which is the
  // whole of what that rule is about.
  provenance: { readonly carried: string; readonly calculated: string },
): { readonly label: string; readonly tone: FieldTone } | undefined {
  if (field.origin === DISCLOSURE_ORIGIN.CALCULATED) {
    return { label: provenance.calculated, tone: FIELD_TONE.NEUTRAL };
  }
  if (field.carriedForward) return { label: provenance.carried, tone: FIELD_TONE.NEUTRAL };
  if (!hasMarker(field.state)) return undefined;
  return { label: labels[field.state], tone: TONE_OF_STATE[field.state] };
}

/**
 * One value a derived figure is computed from (task 36.10; UC-26, UC-27).
 *
 * **`TextField` rather than `DisclosureField`, and the difference is the point.** UX-89 asks whether
 * the *anatomy* differs, and it does: `DisclosureField` requires UX-15's not-available declaration,
 * because every disclosure a reader sees may be deliberately unanswered with a reason. This is not a
 * disclosure — it is not filed, not exported and not validated — so it has no such state, and
 * passing `null` into that required slot would be asserting it does. What is left is a label, help
 * and one numeric control, which is `TextField` exactly. No inventory addition either way.
 *
 * **The published offer is a placeholder, never a written value.** EFRAG prints 2 000 hours and says
 * an undertaking may change it; showing it as the field's value would make an offer the reporter has
 * never looked at indistinguishable from a figure they chose — and the api computes with the offer
 * either way, so nothing is lost by leaving the box empty. That is the same distinction
 * `DisclosureField`'s own `defaultValue` draws for an entity-record answer (task 91.2).
 */
function DerivationInputControl({
  input,
  readOnly,
  label,
  help,
}: {
  readonly input: DerivationInput;
  readonly readOnly: boolean;
  readonly label: string;
  readonly help: string;
}) {
  const { change } = useAutosaveContext();
  const [draft, setDraft] = useState(input.value ?? '');

  return (
    <TextField
      label={label}
      help={help}
      inputMode="decimal"
      value={draft}
      // The published offer, shown as what the field will mean if left empty — never written. EFRAG
      // prints 2 000 hours and permits changing it, so filling the box with 2 000 would make an
      // offer nobody looked at indistinguishable from a figure someone chose. The api computes with
      // the offer regardless, so the empty box costs nothing and says something true.
      placeholder={input.offered ?? undefined}
      readOnly={readOnly}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const parsed = parseDecimalInput(draft);
        // An unparseable draft stays on screen and is not written, exactly as a disclosure's own
        // numeric control does — the reporter keeps what they typed so they can correct it.
        if ('invalid' in parsed) return;
        // Annotated rather than inferred: the queue takes a union, and an inline literal lets
        // TypeScript match it against the disclosure arm first and report a confusing mismatch.
        const write: DerivationInputWrite = { inputKey: input.key, valueNumeric: parsed.value };
        change(write);
      }}
    />
  );
}
