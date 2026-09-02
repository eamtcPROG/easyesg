'use client';

import {
  DISCLOSURE_STATE,
  type DisclosureField as DisclosureFieldShape,
  type DisclosureState,
} from '@easyesg/contracts';
import { DisclosureField, FIELD_TONE, SAVE_STATE, type FieldTone, type SaveState } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { TONE_OF_STATE, hasMarker } from '../field-tone';
import { syncStateOf, writeKey } from '../autosave-state';
import { withCommitted } from '../values';
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
  const { state, change } = useAutosaveContext();
  const syncLabels: Readonly<Record<Exclude<SaveState, typeof SAVE_STATE.SAVED>, string>> = {
    [SAVE_STATE.QUEUED]: t('queued'),
    [SAVE_STATE.SAVING]: t('saving'),
    [SAVE_STATE.FAILED]: t('failed'),
  };

  return (
    <div className={styles.fields}>
      {fields.map((served) => {
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
            label={field.label ?? field.elementKey}
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
      })}
    </div>
  );
}

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
