import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import { NO_DIMENSION } from '../models/disclosure-value.model';
import { targetAxisOf, targetMembers, type TargetAxis } from '../models/target-axis';

/**
 * **How a target axis divides an element's rows among the modules presenting it** (task 79.3; `architecture.md`
 * §12.5.6's task-79.3 row) — three questions over one partition, so they live together and cannot disagree.
 *
 * The base and target members are the target module's alone, and every other row — the undimensioned one, the
 * reporting year's — is the other modules'. So B3 asks the reporting year's Scope 1 and C3 the base year's, a Basic
 * report asks only the first, and C3 shows the first as B3 holds it. **Anywhere else every module presenting the
 * element asks every row** (task 36.4), which is what the shared emissions were before C3 was built.
 */

/** Which modules ask this row of this element — what the write's scope check, progress and its Comprehensive count ask. */
export function modulesAskingRow(input: {
  readonly element: Pick<TaxonomyElement, 'modules' | 'axes'>;
  readonly dimensionKey: string;
  readonly targets: ReadonlyMap<string, TargetAxis>;
}): readonly string[] {
  const axis = targetAxisOf({ element: input.element, targets: input.targets });
  if (axis === null) return input.element.modules;
  if (targetMembers(axis).includes(input.dimensionKey)) return [axis.module];
  return input.element.modules.filter((module) => module !== axis.module);
}

/**
 * The rows this module's step shows for the element where a target axis decides them, or `null` where none does: on the
 * target module, the reporting year's undimensioned row, then the base and the target member — the template's three
 * columns, in its order.
 */
export function targetRowsOn(input: {
  readonly element: Pick<TaxonomyElement, 'axes'>;
  readonly module: string;
  readonly targets: ReadonlyMap<string, TargetAxis>;
}): readonly string[] | null {
  const axis = targetAxisOf({ element: input.element, targets: input.targets });
  if (axis === null || axis.module !== input.module) return null;
  return [NO_DIMENSION, ...targetMembers(axis)];
}

/**
 * The module a row this step shows is answered on, where that is not this step's module — `null` for every row the step
 * asks. C3's reporting-year row is B3's: shown on C3 as B3 holds it, and answered there.
 */
export function answeredElsewhere(input: {
  readonly element: Pick<TaxonomyElement, 'modules' | 'axes'>;
  readonly dimensionKey: string;
  readonly module: string;
  readonly targets: ReadonlyMap<string, TargetAxis>;
}): string | null {
  const asking = modulesAskingRow(input);
  return asking.includes(input.module) ? null : (asking[0] ?? null);
}
