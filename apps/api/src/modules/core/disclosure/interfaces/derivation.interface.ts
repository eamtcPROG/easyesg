import type { Derivation } from '../models/derivation.model';

/**
 * Which figures the standard derives, and from what — configuration, read through a port (AD-4).
 *
 * **A port for `AxisShapes`' stated reason**, which applies here word for word: the answer is
 * configuration and the use case must not know that. The step read asks *what does this element
 * derive from*; that it comes from the configuration store, is cached per revision and degrades to
 * nothing on a malformed payload is the adapter's business.
 *
 * Added 9 Sep 2026 by task 36's parent-close convention review. Three use cases had been importing
 * the `@Injectable` service directly — the first imports from `use-cases/` into `services/` anywhere
 * in `apps/api` — which inverts the dependency rule the root `CLAUDE.md` states and the module
 * anatomy repeats. No gate saw it: `domain-free-of-frameworks` matches npm packages reached from
 * `use-cases/`, so a hop through a first-party service is invisible to it.
 */
export interface Derivations {
  /** Every registered derivation, by the element it produces. */
  all(query: { readonly standard: string }): ReadonlyMap<string, Derivation>;
  /** The one that produces this element, or `null` — which is the ordinary answer. */
  forElement(query: { readonly standard: string; readonly element: string }): Derivation | null;
}

/** DI token beside the interface, as every other port in this module is (P-7). */
export const DERIVATIONS = Symbol('DERIVATIONS');

/**
 * Recomputing what a write moved (task 36.10).
 *
 * Separate from `Derivations` on ISP grounds rather than tidiness: the step read asks what is
 * derived and never recomputes, and both write paths recompute without reading the registry
 * themselves. A consumer must not depend on operations it never calls.
 */
export interface DerivationRecalculator {
  recompute(command: {
    readonly reportId: string;
    readonly standard: string;
    /** Element keys, input keys, or both — a derivation reads from either kind. */
    readonly touched: ReadonlySet<string>;
  }): Promise<void>;
}

export const DERIVATION_RECALCULATOR = Symbol('DERIVATION_RECALCULATOR');
