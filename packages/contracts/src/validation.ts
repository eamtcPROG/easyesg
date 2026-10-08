import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * Validation's vocabulary, consumer side (tasks 41.3, 42.2; FR-41, 182/18) — the mirror of `apps/api`'s
 * `COMPLETION_STATUS`, which the api derives its contract enum from and may not import from here (`membership.ts`'s
 * reason).
 *
 * **What it adds over the generated union is the runtime value**: S-07's module list, S-05 and S-06 branch on a
 * module's or a report's status as the last run left it, and the branch may not be a literal at the site. Held to the
 * generated enum at compile time, so a status the api gains and this file lacks fails `pnpm typecheck` here.
 *
 * The verdicts are not mirrored here: they are `@easyesg/validation`'s `VERDICT`, the interpreter's own, which both
 * front ends already read the rule interpreter from (task 40).
 */
export const COMPLETION_STATUS = {
  /** Nothing resolved or reasoned. */
  NOT_STARTED: 'not_started',
  /** Something outstanding. */
  IN_PROGRESS: 'in_progress',
  /** Nothing outstanding — for the report, ready to file (182/19). */
  COMPLETE: 'complete',
} as const;

export type CompletionStatus = (typeof COMPLETION_STATUS)[keyof typeof COMPLETION_STATUS];

type WireCompletionStatus = components['schemas']['CountsDto']['status'];

export const COMPLETION_STATUS_MIRRORS_WIRE: SameSet<CompletionStatus, WireCompletionStatus> = true;
