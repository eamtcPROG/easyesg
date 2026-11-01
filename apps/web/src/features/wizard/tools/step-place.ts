import type { DisclosureModuleSummary } from '@easyesg/contracts';

/**
 * Where the current module stands in the report's list — its position, the list's length, and the modules either side
 * (task 179.3; `design_spec.md` S-07's amendment of 1 Oct 2026).
 *
 * **Computed once, in the section** (`section-compute-once`): the heading's *Module 1 of 11*, the stepper's *B1 · 1 of
 * 11* and the foot's *Back* and *Next* are one fact drawn three times, and each deriving it would be three answers.
 *
 * **It never gates**: the next module is the next one whatever its state — waiting on B1, ruled out, omitted — because
 * the list beside the step offers every module the same way (the Reporting Core artboard's *rail that never gates*),
 * and a foot that skipped one would be a second, stricter reading of the same order. `null` at either end, so the foot
 * draws no way where there is none, and a position of `0` for a module the list does not carry.
 */
export interface StepPlace {
  /** 1-based; `0` where the list does not carry the module. */
  readonly position: number;
  readonly total: number;
  readonly previous: string | null;
  readonly next: string | null;
}

export function placeOf(input: {
  readonly modules: readonly DisclosureModuleSummary[];
  readonly current: string;
}): StepPlace {
  const at = input.modules.findIndex((summary) => summary.module === input.current);
  if (at === -1) return { position: 0, total: input.modules.length, previous: null, next: null };
  return {
    position: at + 1,
    total: input.modules.length,
    previous: input.modules[at - 1]?.module ?? null,
    next: input.modules[at + 1]?.module ?? null,
  };
}
