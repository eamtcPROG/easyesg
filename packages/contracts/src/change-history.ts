import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * The change history's vocabulary, consumer side (task 84; FR-54, UC-47) — the mirror of `apps/api`'s `CHANGE_SOURCE`,
 * which the api derives its contract enum from and may not import from here (`membership.ts`'s reason).
 *
 * **What it adds over the generated union is the runtime value**: S-12 words each entry's source by it, and the
 * wording is keyed per member, so the members must be iterable and a branch on one may not be a literal. Held to the
 * generated enum at compile time, so a source the api gains and this file lacks fails `pnpm typecheck` here.
 */
export const CHANGE_SOURCE = {
  /** A reporter typed it — the default. */
  TYPED: 'typed',
  /** Taken from the prior period's report (FR-47), whoever wrote it there. */
  CARRIED_FORWARD: 'carried_forward',
  /** Written by the carbon calculator's run (UC-33). */
  CALCULATED: 'calculated',
  /** A reporter's figure in place of a computed one, with a reason (UC-34). */
  OVERRIDDEN: 'overridden',
} as const;

export type ChangeSource = (typeof CHANGE_SOURCE)[keyof typeof CHANGE_SOURCE];

export const CHANGE_SOURCE_MIRRORS_WIRE: SameSet<
  ChangeSource,
  NonNullable<components['schemas']['ChangeEntryDto']['source']>
> = true;
