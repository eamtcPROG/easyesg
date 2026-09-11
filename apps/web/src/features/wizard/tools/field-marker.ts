import { DISCLOSURE_ORIGIN, type DisclosureField as DisclosureFieldShape, type DisclosureState } from '@easyesg/contracts';
import { FIELD_TONE, type FieldTone } from '@easyesg/ui';
import { TONE_OF_STATE, hasMarker } from './field-tone';

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
export function markerFor(
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
