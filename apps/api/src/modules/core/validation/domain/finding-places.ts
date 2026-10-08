import type { DisclosureLabel } from '@easyesg/i18n';
import type { FieldAddress, Finding } from '@easyesg/validation';
import type { FieldPlace, PlacedFinding } from '../models/validation-run.model';

/**
 * **A finding with its field named and placed** (task 42.2; FR-42, S-08; `architecture.md` §12.5.6's task-42 row (e)) —
 * the field's label in the reader's locale, its member's where the catalogue words one, and the modules of the report's
 * scope that present it, for the field and each one it relates to.
 *
 * **Named here because the panel lists findings in modules the browser has not read**: a step's labels arrive with its
 * own step read (OQ-58), so the browser could name only the open step's fields. The labels are the step read's own
 * source, the version the report pins (DR-4), so the panel and the field say the same name.
 *
 * **A member the catalogue does not word is `null`, not its key** — a country (B8's ISO codes, which the browser words
 * from its own catalogue, task 36.9) or a classification's published entry. Never the member key itself, which is an
 * XBRL identifier the reader may not see.
 *
 * Pure, so the naming is a spec rather than a journey: the caller passes the version's labels.
 */
export function placeFindings(input: {
  readonly findings: readonly Finding[];
  /** Where each element of the report's scope sits — the run's scope (`ValidationReading.placedIn`). */
  readonly placedIn: ReadonlyMap<string, readonly string[]>;
  readonly labels: Readonly<Record<string, DisclosureLabel>> | null;
  readonly members: Readonly<Record<string, DisclosureLabel>> | null;
}): readonly PlacedFinding[] {
  const place = (address: FieldAddress): FieldPlace => ({
    ...address,
    label: input.labels?.[address.elementKey]?.text ?? null,
    memberLabel: address.dimensionKey === '' ? null : (input.members?.[address.dimensionKey]?.text ?? null),
    // A field the scope no longer presents — a related field whose module has since been omitted — has nowhere to go.
    modules: input.placedIn.get(address.elementKey) ?? [],
  });
  return input.findings.map((finding) => ({
    ...finding,
    field: place(finding.field),
    related: finding.related.map(place),
  }));
}
