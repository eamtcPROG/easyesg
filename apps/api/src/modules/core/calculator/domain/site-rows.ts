import type { RegisteredTaxonomy } from '@api/contracts/taxonomy-registry.port';
import { B1_ELEMENT } from '@api/modules/core/disclosure/models/b1-element.model';

/**
 * Which of a report's B1 site rows exist — the sites an invoice line may belong to (task 38.1; FR-19, FR-33;
 * §12.5.6's task-38.1 row).
 *
 * **The wizard's own rule, restated as a set**: a typed axis's rows are every ordinal any element on the axis is
 * stored at, plus one per site the period's snapshot holds (`read-wizard-step.use-case.ts`'s `answeredRows`, task
 * 36.6). A line's site must be one of those, so the calculator sums over exactly the sites the report discloses —
 * the boundary B1 states. The row a step shows a report with no sites at all is a place to start typing, not a site,
 * and is not one here.
 */

/**
 * The elements on the site axis, in the report's own pinned version. **The axis is B1's address's**, task 180.3's
 * idiom, rather than its key spelled again here — so a release that renamed the axis moves this with it.
 */
export function siteAxisElements(registered: RegisteredTaxonomy): readonly string[] {
  const address = registered.elements.find((element) => element.key === B1_ELEMENT.SITE_ADDRESS);
  const axis = address?.axes[0];
  if (axis === undefined) return [];
  return registered.elements.filter((element) => element.axes.includes(axis)).map((element) => element.key);
}

export function siteRows(input: {
  /** The ordinals any site-axis element holds a stored value at, in any state. */
  readonly answered: readonly number[];
  /** How many sites the period's snapshot holds — each is a row before anyone answers it. */
  readonly snapshotSites: number;
}): ReadonlySet<number> {
  const rows = new Set(input.answered);
  for (let ordinal = 0; ordinal < input.snapshotSites; ordinal += 1) rows.add(ordinal);
  return rows;
}
