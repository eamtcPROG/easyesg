import { divideDecimals, isDecimalString, sumDecimals } from '@api/contracts/types/decimal';

/**
 * The figures EFRAG computes rather than asks for (task 36.10; FR-29, §7.3) — the Basic module's, and since task 79 the
 * Comprehensive module's: C5's and C9's ratios, C8's fossil-fuel total and its benchmark exclusion, a yes or a no.
 *
 * **The split between this file and the artefact is AD-4's own line, not a preference.** The
 * *operands* — which value feeds which slot, and what the platform offers when nobody has answered —
 * are published data, because EFRAG's own note on the 2 000-hour working year says it *"may vary by
 * country or sector, depending on national rules or collective bargaining agreements"*, and a
 * threshold that varies by jurisdiction is the first thing AD-4 names as configuration. The
 * *arithmetic* is here, because a formula belongs to a template version and DR-4 already pins one
 * per report — a changed formula arrives with a release however it is stored.
 *
 * **A closed set, and no expression language.** CLAUDE.md's *"never widen a question by coding around
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
  /**
   * B10's gender pay gap — `(reference − compared) ÷ reference`, where the reference is the male
   * figure and the compared is the female one.
   *
   * **Signed, and the sign is the disclosure.** A negative result is women paid more on average,
   * which is a real and reportable state; `Math.abs` here would file *a gap of 5%* on an
   * undertaking that has one in the other direction, and no reader could tell the two apart.
   *
   * **The denominator is the reference alone, not the pair's mean.** That is EFRAG's own cell and it
   * is what makes the figure comparable across filings — a symmetric variant would answer a
   * different, smaller number for the same two salaries.
   *
   * The operands are monetary and this result is not: a currency divides out, which is why the two
   * pay figures are stored as bare numbers and open no currency question (§7.3).
   */
  RELATIVE_GAP: 'relative_gap',
  /**
   * B10's collective-bargaining coverage — `part ÷ whole`, the whole being B1's employee count.
   *
   * Distinct from `TURNOVER_RATE` despite both being ratios: that one averages its denominator over
   * two points in time, and this one takes B1's single figure as EFRAG's cell does. Folding them
   * together would need a flag, and a flag on a formula is a second formula wearing one name.
   */
  SHARE_OF_HEADCOUNT: 'share_of_headcount',
  /**
   * B3's location-based Scope 1 and 2 total — every operand summed (task 38.4; §12.5.6's task-38.4 row).
   *
   * **Exact**, unlike the four above: a sum of finite decimals is finite, so it is added as decimal strings
   * (`contracts/types/decimal.ts`) and never as floats — the total sits beside the two figures it is the sum of, and
   * a reader adding them must get the same number. **Every operand is required**: a scope nobody answered is not a
   * scope of zero (FR-30), so a total over one of two is no total.
   */
  SUM: 'sum',
  /**
   * B3's GHG intensity — the sum of every operand but `turnover`, divided by `turnover` — in tCO₂e per unit of the report's
   * currency, EFRAG's `ghgEmissionsPerMonetaryItemType` (task 38.4).
   *
   * **The emissions are summed from the scopes, not read off the derived total**, because a derivation is recomputed
   * from stored operands in one pass and a derived figure feeding another would be read before it was written. Named
   * by role rather than by position, so the market-based intensity later is the same formula over its own scopes.
   *
   * **Division cannot be exact, so it rounds once**: ten significant figures, half-up (the project owner, 1 Oct
   * 2026) — scale-free, since an intensity per leu is ~0.0000004 and decimal places would keep noise or lose it all.
   * No turnover, or a turnover of zero, is no intensity.
   */
  INTENSITY: 'intensity',
  /**
   * C5's female-to-male ratio at management level — `numerator ÷ denominator`, the female count over the male (task
   * 79.5; §12.5.6's task-79.5 row).
   *
   * **No ratio where the denominator is zero**: the template's cell divides with no guard and shows `#DIV/0!`, and a
   * zero here would file *no women in management* for a management of women alone. A zero numerator is a ratio of
   * zero, a nil return (FR-30).
   */
  RATIO: 'ratio',
  /**
   * C9's gender diversity ratio in the governance body — `numerator ÷ denominator`, the female members over the male,
   * **and zero where either count is zero** (task 79.9; §12.5.6's task-79.9 row), as the template's `H33` computes it.
   *
   * **A formula of its own rather than `RATIO` with a flag**, because the zero rule is the opposite: the project owner
   * chose EFRAG's cell, so the PDF and the Excel file, whose template computes its own cell from the two counts, agree.
   */
  GENDER_DIVERSITY_RATIO: 'gender_diversity_ratio',
  /**
   * C8's exclusion from EU Paris-aligned benchmarks — **yes as soon as one operand is yes, no once every operand is no**,
   * and no answer while some are unanswered and none is yes (task 79.8; §12.5.6's task-79.8 row). The operands are the
   * template's revenue thresholds, each a yes/no derivation input.
   *
   * **The one formula whose answer is a yes or a no**, so it is `computeAffirmation`'s rather than `computeDerivation`'s,
   * and its inputs are answered yes or no (`inputAnswerOf`).
   */
  ANY_AFFIRMED: 'any_affirmed',
} as const;

/** The precision an intensity is stored at (§12.5.6's task-38.4 row). Display rounds further. */
export const INTENSITY_SIGNIFICANT_FIGURES = 10;

export type DerivationFormula = (typeof DERIVATION_FORMULA)[keyof typeof DERIVATION_FORMULA];

/** Is this unvalidated value one of them? Beside the set, not retyped at each reader (CLAUDE.md). */
export const isDerivationFormula = (value: unknown): value is DerivationFormula =>
  typeof value === 'string' && (Object.values(DERIVATION_FORMULA) as string[]).includes(value);

/**
 * How a derivation input is answered (task 79.8): a number, or a yes or a no. **The formula says which** — `any_affirmed`
 * reads yes/no answers and every other formula numbers — so an operand needs no kind of its own to disagree with it.
 */
export const INPUT_ANSWER = { NUMBER: 'number', YES_NO: 'yes_no' } as const;

export type InputAnswer = (typeof INPUT_ANSWER)[keyof typeof INPUT_ANSWER];

/** How the inputs of a derivation with this formula are answered. */
export const inputAnswerOf = (formula: DerivationFormula): InputAnswer =>
  formula === DERIVATION_FORMULA.ANY_AFFIRMED ? INPUT_ANSWER.YES_NO : INPUT_ANSWER.NUMBER;

/**
 * A yes/no input as `core.report_derivation_input.value_numeric` holds it (task 79.8; §12.5.6's task-79.8 row) — the
 * column every input is held in (§7.3), so a yes is `1` and a no `0`, as the template map's *affirmed* gates read a
 * figure above zero as a yes.
 */
export const YES_NO_INPUT = { YES: '1', NO: '0' } as const;

/** Is this a yes/no input's stored answer? The write refuses anything else for such an input. */
export const isYesNoInput = (value: string): boolean => value === YES_NO_INPUT.YES || value === YES_NO_INPUT.NO;

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
  /**
   * The target axis this derivation holds along as well, or `null` (task 79.3; §12.5.6's task-79.3 row): worked out at
   * the axis's base and target members too, from the disclosure operands at the same member. B3's location-based Scope
   * 1 and Scope 2 total is the one, so C3's base-year total is its base-year parts' sum. **Named here rather than
   * inferred**, because the calculator recomputes for a standard and never reads a pinned version's axes.
   */
  readonly along: string | null;
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
    // own cell shows "-" for it. Dividing anyway yields Infinity or NaN, and **nothing below this catches that** — verified 9 Sep 2026: PostgreSQL's `numeric` accepts both, and `report_disclosure_value` carries no `CHECK` on `value_numeric`. So this guard is the only thing between a zero denominator and an infinite rate filed with `origin = 'calculated'`. Earlier versions of this comment claimed the database refused it; it does not.
    if (average === 0) return null;
    return String(departures / average);
  }

  if (input.formula === DERIVATION_FORMULA.RELATIVE_GAP) {
    const reference = number('reference');
    const compared = number('compared');
    if (reference === null || compared === null) return null;
    // A zero reference is not a gap of nothing — it is a gap of no defined size, and EFRAG's cell
    // shows "-". Dividing anyway yields Infinity or NaN, and **nothing below this catches that** — verified 9 Sep 2026: PostgreSQL's `numeric` accepts both, and `report_disclosure_value` carries no `CHECK` on `value_numeric`. So this guard is the only thing between a zero denominator and an infinite rate filed with `origin = 'calculated'`. Earlier versions of this comment claimed the database refused it; it does not.
    if (reference === 0) return null;
    return String((reference - compared) / reference);
  }

  if (input.formula === DERIVATION_FORMULA.SHARE_OF_HEADCOUNT) {
    const part = number('part');
    const whole = number('whole');
    if (part === null || whole === null) return null;
    // EFRAG's own cell tests this explicitly — `IF('General Information'!E284=0, "-", …)`.
    if (whole === 0) return null;
    return String(part / whole);
  }

  if (input.formula === DERIVATION_FORMULA.ACCIDENT_RATE) {
    const accidents = number('accidents');
    const hours = number('hoursPerFullTimeEmployee');
    const employees = number('employees');
    if (accidents === null || hours === null || employees === null) return null;
    const totalHours = hours * employees;
    // A zero working year or an empty workforce is no rate, not a rate of infinity. The reporter
    // can produce both: `WriteDerivationInputs` accepts a `0` for the hours figure.
    if (totalHours === 0) return null;
    return String((accidents / totalHours) * ACCIDENT_RATE_BASE);
  }

  if (input.formula === DERIVATION_FORMULA.SUM) {
    // Decimal strings throughout, never `number()`: the sum is exact, and a negative or malformed operand is not a
    // figure this formula sums but a question with no answer yet.
    const parts = Object.values(input.operands);
    if (parts.length === 0 || !parts.every(isDecimalString)) return null;
    return sumDecimals(parts);
  }

  if (input.formula === DERIVATION_FORMULA.INTENSITY) {
    const { turnover, ...emissions } = input.operands;
    const parts = Object.values(emissions);
    if (!isDecimalString(turnover) || parts.length === 0 || !parts.every(isDecimalString)) return null;
    return divideDecimals(sumDecimals(parts), turnover, { significantFigures: INTENSITY_SIGNIFICANT_FIGURES });
  }

  if (input.formula === DERIVATION_FORMULA.RATIO || input.formula === DERIVATION_FORMULA.GENDER_DIVERSITY_RATIO) {
    const numerator = number('numerator');
    const denominator = number('denominator');
    if (numerator === null || denominator === null) return null;
    // The two ratios part here and only here (§12.5.6's task-79.5 and task-79.9 rows): C9's is EFRAG's `H33`, zero
    // where either count is; C5's has no figure where it cannot divide.
    if (input.formula === DERIVATION_FORMULA.GENDER_DIVERSITY_RATIO && (numerator === 0 || denominator === 0)) {
      return '0';
    }
    if (denominator === 0) return null;
    return String(numerator / denominator);
  }

  // A yes or a no is not a figure: `computeAffirmation` answers it, and `derivedAnswer` is what dispatches.
  if (input.formula === DERIVATION_FORMULA.ANY_AFFIRMED) return null;

  // **Named rather than fallen through to** (gate-integrity review, 9 Sep 2026). As an implicit
  // `else` this branch answered every formula, so a fifth kind whose own branch was forgotten would
  // silently compute an *accident rate* from operands it does not have — `null`, because the names
  // would not resolve, which reads as "not enough answers yet" rather than as the mistake it is.
  return null;
}

/**
 * Work out a yes or a no from yes/no operands (`any_affirmed`, task 79.8): yes as soon as one is yes, no once every one
 * is no, and `null` while some are unanswered and none is yes — **an unanswered threshold is not a no**, FR-30's
 * distinction carried to a yes/no, so a reporter whose answers so far are all no is told nothing rather than *not
 * excluded*.
 */
export function computeAffirmation(input: { readonly operands: Readonly<Record<string, string | null>> }): boolean | null {
  const answers = Object.values(input.operands);
  if (answers.length === 0) return null;
  if (answers.some((answer) => answer === YES_NO_INPUT.YES)) return true;
  return answers.every((answer) => answer === YES_NO_INPUT.NO) ? false : null;
}

/** What a derivation writes: a figure, or a yes or a no — never both (task 79.8). */
export interface DerivedAnswer {
  readonly valueNumeric: string | null;
  readonly valueBoolean: boolean | null;
}

/**
 * The answer a derivation's formula gives, in the column it belongs in — the one place a formula's answer kind is
 * decided, so the calculator never asks which.
 */
export function derivedAnswer(input: {
  readonly formula: DerivationFormula;
  readonly operands: Readonly<Record<string, string | null>>;
}): DerivedAnswer {
  return input.formula === DERIVATION_FORMULA.ANY_AFFIRMED
    ? { valueNumeric: null, valueBoolean: computeAffirmation({ operands: input.operands }) }
    : { valueNumeric: computeDerivation(input), valueBoolean: null };
}

/**
 * The base the accident rate is expressed against — 100 full-time workers × 40 hours × 50 weeks.
 *
 * Named rather than written into the expression, because `200000` in a division reads as a magic
 * number and this one has a meaning a reader needs: it is what makes the result *accidents per 100
 * workers per year* rather than a bare ratio.
 */
const ACCIDENT_RATE_BASE = 200_000;
