/**
 * How many decimal places a surface rounds a computed figure to, by unit (task 39.2; NFR-18; `architecture.md` §12.5.6's
 * task-182 row (3) and task-39 row (5)).
 *
 * **Every surface rounds once, half-up, to the same places** — S-09, the wizard, the PDF (44) and the Excel export (46)
 * — so the four formats cannot disagree about a filed figure. The places are configuration (AD-4): the
 * `presentation_precision` artefact, published and reverted with no release. A figure is stored exact; this is only how
 * many of its digits a reader is shown.
 *
 * In `contracts/` because its readers are several modules and both entrypoints: the calculator serves it to the browser
 * with S-09's read, and the worker's exports will read it where they render.
 */
export interface PresentationPrecision {
  /**
   * Decimal places by unit code (`tCO2e`, `MWh`). **A unit absent from the answer is shown unrounded** — exact, so never
   * wrong, only long — which is also the whole answer while the artefact cannot be read: a screen cannot refuse to show
   * a figure the way a write can refuse to happen, so this fails open, toward the truth, and says so in the log.
   */
  places(): Readonly<Record<string, number>>;
}

/** DI token beside the interface, so a consumer imports one thing (P-7). */
export const PRESENTATION_PRECISION = Symbol('PRESENTATION_PRECISION');
