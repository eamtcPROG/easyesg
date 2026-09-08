/**
 * Which of a standard's explicit axes are **breakdowns** — answered for every member — rather than
 * classifications the reporter selects from (task 36.4).
 *
 * A port because the answer is configuration (AD-4) and the use case must not know that: the step
 * read asks *is this axis a breakdown*, and where the answer comes from is the adapter's business.
 * `constants/disclosure.constants.ts` carries why the distinction cannot be derived from EFRAG's
 * package.
 */
export interface AxisShapes {
  /** The axis keys this standard reports along every member of. Empty where none is registered. */
  breakdownAxes(query: { readonly standard: string }): ReadonlySet<string>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const AXIS_SHAPES = Symbol('AXIS_SHAPES');
