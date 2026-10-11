import type { TaxonomyPin } from '@api/contracts/taxonomy-registry.port';

/** The versions a report's pin is superseded by, where it is. */
export interface SupersedingPin {
  readonly taxonomyVersion: string;
  readonly templateVersion: string;
}

/**
 * Whether a report's pin is superseded, and by what (task 47; FR-51; §12.5.6's task-47 row (6)): **when the versions a
 * new report would pin today differ from its own**. Adopted, not merely registered — a release registered ahead of
 * its adoption supersedes nothing yet. `null` where the pin is current, or where nothing is adopted to compare with,
 * which is a registry with no adoption and never a reason to tell a reporter their pin is stale.
 */
export function supersedingPin(input: {
  readonly report: { readonly taxonomyVersion: string; readonly templateVersion: string };
  readonly adopted: TaxonomyPin | null;
}): SupersedingPin | null {
  const { report, adopted } = input;
  if (adopted === null) return null;
  if (adopted.taxonomyVersion === report.taxonomyVersion && adopted.templateVersion === report.templateVersion) return null;
  return { taxonomyVersion: adopted.taxonomyVersion, templateVersion: adopted.templateVersion };
}
