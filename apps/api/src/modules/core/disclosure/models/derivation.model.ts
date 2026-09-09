/**
 * The Basic-module figures EFRAG computes rather than asks for (task 36.10; FR-29, §7.3).
 *
 * **The split between this file and the artefact is AD-4's own line, not a preference.** The
 * *operands* — which value feeds which slot, and what the platform offers when nobody has answered —
 * are published data, because EFRAG's own note on the 2 000-hour working year says it *"may vary by
 * country or sector, depending on national rules or collective bargaining agreements"*, and a
 * threshold that varies by jurisdiction is the first thing AD-4 names as configuration. The
 * *arithmetic* is here, because a formula belongs to a template version and DR-4 already pins one
 * per report — a changed formula arrives with a release however it is stored.
 *
 * **Two members, and no expression language.** CLAUDE.md's *"never widen a question by coding around
 * it"* names this shape exactly: an interpreter for two formulas is an abstraction nobody asked for,
 * and it would make the arithmetic unreviewable in the bargain. A third rate that reuses one of
 * these shapes is a line of data; a genuinely new shape is a release, and should be.
 */
export const DERIVATION_FORMULA = {
  /**
   * B8's employee turnover — `departures ÷ ((employees at start + employees at end) ÷ 2)`.
   *
   * The denominator is the *average* workforce over the period, which is why B1's single headcount
   * cannot serve: B1 states one figure on a declared basis (`EmployeeCountingMethodology`), and this
   * needs two points in time. EFRAG keeps them as separate cells for that reason.
   */
  TURNOVER_RATE: 'turnover_rate',
  /**
   * B9's recordable-accident rate — `(accidents ÷ (hours per full-time employee × employees))
   * × 200 000`.
   *
   * The 200 000 is the conventional base: 100 full-time workers at 40 hours over 50 weeks, so the
   * result reads as *accidents per 100 workers per year*. It is part of the formula rather than a
   * published constant, because changing it does not adjust a threshold — it changes what the number
   * means, and a filing carrying a differently-based rate under the same element would be wrong
   * rather than tuned.
   */
  ACCIDENT_RATE: 'accident_rate',
} as const;

export type DerivationFormula = (typeof DERIVATION_FORMULA)[keyof typeof DERIVATION_FORMULA];

/** Is this unvalidated value one of the two? Beside the set, not retyped at each reader (CLAUDE.md). */
export const isDerivationFormula = (value: unknown): value is DerivationFormula =>
  typeof value === 'string' && (Object.values(DERIVATION_FORMULA) as string[]).includes(value);

/** Where an operand's value comes from. */
export const OPERAND_SOURCE = {
  /** A reportable disclosure — the reporter answers it as a field, and the export emits it. */
  DISCLOSURE: 'disclosure',
  /** A derivation input: report-scoped, entered, and carrying no taxonomy element (§7.3). */
  INPUT: 'input',
} as const;

export type OperandSource = (typeof OPERAND_SOURCE)[keyof typeof OPERAND_SOURCE];

export const isOperandSource = (value: unknown): value is OperandSource =>
  typeof value === 'string' && (Object.values(OPERAND_SOURCE) as string[]).includes(value);

/** One slot of a formula, bound to where its value is read from. */
export interface DerivationOperand {
  readonly from: OperandSource;
  readonly key: string;
  /**
   * What the platform offers where nothing is stored, as a decimal string; `null` for an operand
   * with no sensible offer. Only `HoursWorkedByOneFullTimeEmployee` carries one today — EFRAG prints
   * 2 000 in the cell — and a default on a *count* would be inventing a reporter's answer.
   */
  readonly fallback: string | null;
}

/** One derived element and the operands its formula reads. */
export interface Derivation {
  readonly element: string;
  readonly formula: DerivationFormula;
  readonly operands: Readonly<Record<string, DerivationOperand>>;
}

/**
 * Compute a derived figure, or answer `null` where it cannot be computed yet.
 *
 * **`null` rather than zero for an unanswerable rate**, which is the distinction FR-30 turns on: a
 * rate the reporter has not supplied the inputs for is *missing*, and a rate that genuinely works
 * out to zero — no accidents in the period — is a **nil return**, an affirmative disclosure. Folding
 * them together would report *no accidents* on a report where nobody had said anything.
 *
 * Values arrive as decimal strings because that is what `numeric` reads back as, and go out the same
 * way: this is a figure a filing carries, and a float cannot represent 0.1 (§7.3).
 */
export function computeDerivation(input: {
  readonly formula: DerivationFormula;
  readonly operands: Readonly<Record<string, string | null>>;
}): string | null {
  const number = (name: string): number | null => {
    const raw = input.operands[name];
    if (raw === null || raw === undefined || raw.trim() === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  if (input.formula === DERIVATION_FORMULA.TURNOVER_RATE) {
    const departures = number('departures');
    const atStart = number('atStart');
    const atEnd = number('atEnd');
    if (departures === null || atStart === null || atEnd === null) return null;
    const average = (atStart + atEnd) / 2;
    // A zero average workforce is not a rate of zero — it is a question with no answer, and EFRAG's
    // own cell shows "-" for it. Dividing anyway yields Infinity or NaN, which `numeric` refuses.
    if (average === 0) return null;
    return String(departures / average);
  }

  const accidents = number('accidents');
  const hours = number('hoursPerFullTimeEmployee');
  const employees = number('employees');
  if (accidents === null || hours === null || employees === null) return null;
  const totalHours = hours * employees;
  if (totalHours === 0) return null;
  return String((accidents / totalHours) * ACCIDENT_RATE_BASE);
}

/**
 * The base the accident rate is expressed against — 100 full-time workers × 40 hours × 50 weeks.
 *
 * Named rather than written into the expression, because `200000` in a division reads as a magic
 * number and this one has a meaning a reader needs: it is what makes the result *accidents per 100
 * workers per year* rather than a bare ratio.
 */
const ACCIDENT_RATE_BASE = 200_000;
