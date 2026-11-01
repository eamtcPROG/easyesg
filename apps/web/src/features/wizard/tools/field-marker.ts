import { DISCLOSURE_ORIGIN, type DisclosureField as DisclosureFieldShape, type DisclosureState } from '@easyesg/contracts';
import { FIELD_TONE, type FieldTone } from '@easyesg/ui';
import type { Verdict } from '@easyesg/validation';
import { TONE_OF_STATE, hasMarker } from './field-tone';

/**
 * What the field says about itself, where it has something to say.
 *
 * **A finding's verdict is read first** (task 42.1; FR-40, BR-VAL-1; `architecture.md` §12.5.6's task-42 row (1)): the
 * field's one state among those its findings fire, live where the open step can evaluate the rule and as the last run
 * found it otherwise. It outranks every marker below because it is the one the reader has to act on — a calculated
 * figure that moved beyond the year's threshold says so here, and the computed-figure control beside it still says
 * where the figure came from.
 *
 * **Then origin, the one marker about where a figure CAME FROM** rather than about its state (task 36.4). UC-21's
 * alternate flow makes B3's figures *"normally produced by the carbon calculator rather than typed directly"*, and
 * UX-12 hangs a provenance mark off exactly this distinction — a trace can only be offered for a figure the system
 * computed. `calculated` is written by a calculator run (task 38.4) and by B3's two derivations over it; `overridden`
 * is marked, and the marker is not the override's whole display — UX-43's superseded value and reason are the control
 * beside it (task 39.3).
 *
 * **Then the company record, since task 180.3**: a value the api says still is what the record gives reads *From the
 * company record*, after calculated and carried forward, because each of those says more about where the figure came
 * from.
 *
 * **Last the answer's own kind** — declared not available, a nil return — since 182/17 the only states a field's row
 * holds; `ok` is the absence of a marker.
 */
export function markerFor(input: {
  readonly field: DisclosureFieldShape;
  /** The field's one verdict among its findings, or `null` where none names it — the field is OK. */
  readonly verdict: Verdict | null;
  readonly labels: Readonly<Record<DisclosureState, string>>;
  // Named rather than two adjacent `string`s, per the root CLAUDE.md: swapped, the call compiles
  // and every calculated figure reads *carried forward* — a plausible wrong answer, which is the
  // whole of what that rule is about.
  readonly provenance: {
    readonly carried: string;
    readonly calculated: string;
    readonly overridden: string;
    readonly record: string;
  };
}): { readonly label: string; readonly tone: FieldTone } | undefined {
  const { field, verdict, labels, provenance } = input;
  if (verdict !== null) return { label: labels[verdict], tone: TONE_OF_STATE[verdict] };
  if (field.origin === DISCLOSURE_ORIGIN.CALCULATED) {
    return { label: provenance.calculated, tone: FIELD_TONE.NEUTRAL };
  }
  // A substituted figure (task 39.3): amber and resolved — the artboard's *"a decision recorded, never a problem
  // outstanding"*. The superseded figure and the reason are the field's control, beside it (UX-43).
  if (field.origin === DISCLOSURE_ORIGIN.OVERRIDDEN) {
    return { label: provenance.overridden, tone: FIELD_TONE.WARNING };
  }
  if (field.carriedForward) return { label: provenance.carried, tone: FIELD_TONE.NEUTRAL };
  if (field.fromRecord) return { label: provenance.record, tone: FIELD_TONE.NEUTRAL };
  if (!hasMarker(field.state)) return undefined;
  return { label: labels[field.state], tone: TONE_OF_STATE[field.state] };
}
