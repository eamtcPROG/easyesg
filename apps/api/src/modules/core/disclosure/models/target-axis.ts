import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';

/**
 * A **target axis** (task 79.3; `architecture.md` §12.5.6's task-79.3 row) — an axis one module asks at a base member
 * and a target member, beside the undimensioned row its element's other modules ask.
 *
 * `ReportingScopesAxis` with C3 is the one registered (the axis-shape spec holds the shipped artefact to it): its members
 * are *which year* — base, target, currently stated — and B3 states the reporting year's emissions as the undimensioned
 * row, so C3 states the same emissions at the base year and the target year. **Registered rather than read off the
 * axis**, as a breakdown is: nothing in EFRAG's package says which member is the base, nor which module asks it (AD-4).
 */
export interface TargetAxis {
  /** The axis's key — `ReportingScopesAxis`. */
  readonly key: string;
  /** The module that asks the axis at its two members — C3. */
  readonly module: string;
  /** The member a target is measured from. */
  readonly base: string;
  /** The member a target is set for. */
  readonly target: string;
}

/** The two members a target axis is asked at, base first — the order the step serves them in and the template prints. */
export const targetMembers = (axis: TargetAxis): readonly string[] => [axis.base, axis.target];

/** The target axis this element is reported along, or `null` — which is the ordinary answer. */
export function targetAxisOf(input: {
  readonly element: Pick<TaxonomyElement, 'axes'>;
  readonly targets: ReadonlyMap<string, TargetAxis>;
}): TargetAxis | null {
  for (const key of input.element.axes) {
    const axis = input.targets.get(key);
    if (axis !== undefined) return axis;
  }
  return null;
}
