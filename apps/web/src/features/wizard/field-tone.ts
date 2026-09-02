import { DISCLOSURE_STATE, type DisclosureState } from '@easyesg/contracts';
import { FIELD_TONE, type FieldTone } from '@easyesg/ui';

/**
 * A stored disclosure state as the field paints it — §6.4's table, declared once (task 35.2).
 *
 * `packages/ui` takes a *tone* rather than the store's state on purpose (task 36.1's decision), so
 * this mapping is the app's: eight states onto the cascade's six colour roles, with `error` and
 * `invalid_url` sharing one and the two reasoned states another, exactly as §6.4 says — *"colour
 * carries severity, the mark and label carry identity"*. The label is the catalogue's, keyed by
 * state, and `ok` carries no marker at all ("neutral, no marker in the field itself").
 */
export const TONE_OF_STATE: Readonly<Record<DisclosureState, FieldTone>> = {
  [DISCLOSURE_STATE.OK]: FIELD_TONE.OK,
  [DISCLOSURE_STATE.MISSING]: FIELD_TONE.ATTENTION,
  [DISCLOSURE_STATE.INCONSISTENCY]: FIELD_TONE.WARNING,
  [DISCLOSURE_STATE.ERROR]: FIELD_TONE.ERROR,
  [DISCLOSURE_STATE.INVALID_URL]: FIELD_TONE.ERROR,
  [DISCLOSURE_STATE.NOT_AVAILABLE]: FIELD_TONE.REASONED,
  [DISCLOSURE_STATE.NOT_MATERIAL]: FIELD_TONE.REASONED,
  [DISCLOSURE_STATE.NIL_RETURN]: FIELD_TONE.NEUTRAL,
};

/** The states that show a marker beside the label. `ok` is the absence of one. */
export const hasMarker = (state: DisclosureState): boolean => state !== DISCLOSURE_STATE.OK;
