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
  Fieldset,
  FIELD_TONE,
  SAVE_STATE,
  type FieldTone,
  type SaveState,
} from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TONE_OF_STATE, hasMarker } from '../field-tone';
import { syncStateOf, writeKey } from '../autosave-state';
import { STEP_ENTRY, isLastRow, layOutStep, withAddedRows } from '../step-layout';
import { outstandingDefaults, withCommitted } from '../values';
import { useAutosaveContext } from './autosave-context';
import { DisclosureControl } from './disclosure-control';
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
  readOnly,
  markerLabels,
  carriedLabel,
}: {
  readonly fields: readonly DisclosureFieldShape[];
  readonly readOnly: boolean;
  /** §6.4's label per state, in the reader's language. `ok` carries no marker and is unused. */
  readonly markerLabels: Readonly<Record<DisclosureState, string>>;
  /** UX-32's "carried" mark, shown until the value is edited. */
  readonly carriedLabel: string;
}) {
  const t = useTranslations('organization.wizard.field.sync');
  const tField = useTranslations('organization.wizard.field');
  const tGroup = useTranslations('organization.wizard.group');
  const { state, change } = useAutosaveContext();
  const syncLabels: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, string>> = {
    [SAVE_STATE.QUEUED]: t('queued'),
    [SAVE_STATE.SAVING]: t('saving'),
    [SAVE_STATE.FAILED]: t('failed'),
  };

  // Axis to the word for one of its rows. Built like `markerLabels` on the page above — the
  // catalogue is indexed by a literal, and an axis it does not name gets a neutral word rather than
  // a taxonomy identifier on a screen.
  const rowNames: Readonly<Record<string, string>> = {
    [TYPED_AXIS.SITE]: tGroup('names.IdentifierOfSiteTypedAxis'),
    [TYPED_AXIS.SUBSIDIARY]: tGroup('names.IdentifierOfSubsidiaryTypedAxis'),
    [TYPED_AXIS.MATERIAL]: tGroup('names.IdentifierOfMaterialTypedAxis'),
  };

  // How many rows the reporter has added to each axis beyond the ones the api served. One value
  // nothing else moves with, which is the case the reducer rule leaves to a single `useState`.
  const [added, setAdded] = useState<Readonly<Record<string, number>>>({});

  // Once per step, and guarded by a ref rather than by a dependency list: `fields` is a new array
  // on every render of the server component above, so a list would re-fire and re-queue writes the
  // store has already acknowledged.
  const committedDefaults = useRef(false);
  useEffect(() => {
    if (committedDefaults.current || readOnly) return;
    committedDefaults.current = true;
    for (const write of outstandingDefaults(fields)) change(write);
  }, [fields, readOnly, change]);

  // **Memoized deliberately, and this is one of the three cases `apps/web/CLAUDE.md` says bite with
  // `reactCompiler` off** — grouping a list, recomputed per render. This component re-renders on
  // every autosave transition (the context), while `fields` and `added` move only when the server
  // re-renders or a row is added, so the grouping ran on every keystroke's acknowledgement.
  const entries = useMemo(() => withAddedRows(layOutStep(fields), added), [fields, added]);

  return (
    <div className={styles.fields}>
      {entries.map((entry) =>
        entry.kind === STEP_ENTRY.GROUP ? (
          <Fieldset
            key={`${entry.axis} ${entry.ordinal}`}
            legend={tGroup('legend', {
              name: rowNames[entry.axis] ?? tGroup('fallbackName'),
              position: entry.ordinal + 1,
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
        ) : (
          renderField(entry.field)
        ),
      )}
    </div>
  );

  function renderField(served: DisclosureFieldShape) {
    const key = writeKey(served);
    const field = withCommitted(served, state.committed[key]);
    const sync = syncStateOf(state, key);
    const marker =
      sync === SAVE_STATE.SAVED
        ? markerFor(field, markerLabels, carriedLabel)
        : { label: syncLabels[sync], tone: SYNC_TONE[sync] };
    const labelId = labelIdFor(key);
    return (
      <DisclosureField
        key={key}
        labelId={labelId}
        // Never the element key — the user-facing-text rule's own example (found by the convention
        // review, 3 Sep 2026, at two sites this task did not write and one it did).
        label={field.label ?? tField('unnamed')}
        help={field.help}
        marker={marker?.label}
        markerTone={marker?.tone}
        unit={field.unitCode === null ? undefined : <span className={styles.unit}>{field.unitCode}</span>}
        message={field.state === DISCLOSURE_STATE.NOT_AVAILABLE ? field.notAvailableReason : undefined}
        messageTone={FIELD_TONE.REASONED}
        notAvailable={null}
        readOnly={readOnly}
      >
        <DisclosureControl field={field} readOnly={readOnly} labelledBy={labelId} onCommit={change} />
      </DisclosureField>
    );
  }
}

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

function markerFor(
  field: DisclosureFieldShape,
  labels: Readonly<Record<DisclosureState, string>>,
  carriedLabel: string,
): { readonly label: string; readonly tone: FieldTone } | undefined {
  if (field.carriedForward) return { label: carriedLabel, tone: FIELD_TONE.NEUTRAL };
  if (!hasMarker(field.state)) return undefined;
  return { label: labels[field.state], tone: TONE_OF_STATE[field.state] };
}
