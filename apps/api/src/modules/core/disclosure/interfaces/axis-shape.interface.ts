/**
 * What shape each of a standard's explicit axes is answered in (task 36.4; **three since 36.5**).
 *
 * A port because the answer is configuration (AD-4) and the use case must not know that: the step
 * read asks *what shape is this axis*, and where the answer comes from is the adapter's business.
 * `constants/disclosure.constants.ts` carries why none of it can be derived from EFRAG's package.
 *
 * **Three shapes, two registered lists and one default**, which is what makes the default the safe
 * one rather than a fourth case to remember:
 *
 * - a **breakdown** is answered for every member — B3's energy as total, renewable, non-renewable;
 * - a **classification** is selected from — B4's 94 pollutants, B7's 973 waste categories, where
 *   the rows are the ones a report holds and the reporter adds another;
 * - **everything else is one undimensioned row**, which is right whenever the axis's own default
 *   member IS the answer. `ReportingScopesAxis` is the worked example and the reason this is a
 *   third shape rather than *not a breakdown*: its members are baseline year / target year /
 *   currently stated — *which year*, not which scope — so on B3 the reporter states the current
 *   figure and one row is correct. Reading it as a classification would put a year picker over
 *   eight emissions disclosures.
 */
export interface AxisShapes {
  /** The axis keys this standard reports along every member of. Empty where none is registered. */
  breakdownAxes(query: { readonly standard: string }): ReadonlySet<string>;
  /** The axis keys whose rows a reporter selects from the domain. Empty where none is registered. */
  classificationAxes(query: { readonly standard: string }): ReadonlySet<string>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const AXIS_SHAPES = Symbol('AXIS_SHAPES');
