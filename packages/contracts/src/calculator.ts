import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * The carbon calculator's vocabulary, consumer side (task 39.1; FR-33, FR-34) — the mirror of `apps/api`'s
 * `GHG_SCOPE`, which the api derives its contract enum from and may not import from here (`membership.ts`'s reason).
 *
 * **What it adds over the generated union is the runtime value**: S-09 groups the sources a line may name by the B3
 * figure they count toward — *fuel you burn* and *electricity you buy*, the artboard's groups — and the grouping may not
 * be a literal at the site. Held to the generated enum at compile time, so a scope the api gains and this file lacks
 * fails `pnpm typecheck` here, naming the mirror.
 */
export const GHG_SCOPE = {
  /** Fuel the undertaking burns — B3's Scope 1. */
  SCOPE_1: 'scope_1',
  /** Electricity bought from the grid, at the grid-average factor — B3's location-based Scope 2. */
  SCOPE_2_LOCATION_BASED: 'scope_2_location_based',
} as const;

export type GhgScope = (typeof GHG_SCOPE)[keyof typeof GHG_SCOPE];

type WireGhgScope = components['schemas']['CalcFactorSourceDto']['ghgScope'];

export const GHG_SCOPE_MIRRORS_WIRE: SameSet<GhgScope, WireGhgScope> = true;

/**
 * A line's outcome in a computation (task 38.4) — measured, explained with no figure, or measured and its tonnes
 * replaced — the mirror of `apps/api`'s `LINE_OUTCOME`, held to the generated enum like `GHG_SCOPE`. S-09 branches on it
 * to draw a line's converted and emissions cells (task 39.2).
 */
export const LINE_OUTCOME = {
  COMPUTED: 'computed',
  NOT_AVAILABLE: 'not_available',
  OVERRIDDEN: 'overridden',
} as const;

export type LineOutcome = (typeof LINE_OUTCOME)[keyof typeof LINE_OUTCOME];

type WireLineOutcome = components['schemas']['ScopeLineDto']['outcome'];

export const LINE_OUTCOME_MIRRORS_WIRE: SameSet<LineOutcome, WireLineOutcome> = true;

/**
 * The two B3 figures a calculator run writes (task 39.3) — Scope 1 and location-based Scope 2, EFRAG's element keys —
 * the mirror of `apps/api`'s `B3_ELEMENT`. **The fields S-07 gives the computed-figure control**: a run can make them
 * `calculated`, after which the ordinary write refuses them and an override or an explanation is the only way to touch
 * them (§12.5.6's task-38.4 row (4)). The wire states them as strings, so there is no generated enum to hold this to;
 * what holds it is the browser journey — a key spelled wrong renders the ordinary control, whose write the api refuses.
 */
export const CALCULATOR_FIGURE = {
  SCOPE_1: 'GrossScope1GreenhouseGasEmissions',
  SCOPE_2_LOCATION_BASED: 'GrossLocationBasedScope2GreenhouseGasEmissions',
} as const;

export type CalculatorFigure = (typeof CALCULATOR_FIGURE)[keyof typeof CALCULATOR_FIGURE];

/** Is this element one of the two a run writes? Beside the set, not retyped at each reader. */
export const isCalculatorFigure = (elementKey: string): elementKey is CalculatorFigure =>
  (Object.values(CALCULATOR_FIGURE) as string[]).includes(elementKey);
