import {
  DERIVATION_FORMULA,
  INPUT_ANSWER,
  computeAffirmation,
  computeDerivation,
  derivedAnswer,
  inputAnswerOf,
  type DerivationFormula,
} from './derivation.model';
import { DISCLOSURE_STATE, answeredState } from './disclosure-value.model';

/**
 * The arithmetic EFRAG's Digital Template 1.3.0 carries, asserted against the workbook's own cells
 * rather than against a restatement of them (task 36.10).
 *
 * Both formulas were read out of `Social Disclosures`: `D137` for the turnover rate and `D143` for
 * the accident rate, with `D142` supplying the latter's denominator. The literals below are the
 * template's, so a formula quietly changed here fails against the source rather than against a copy
 * of itself.
 */
describe('the figures EFRAG derives', () => {
  describe('B8 — employee turnover', () => {
    const turnover = (departures: string, atStart: string, atEnd: string) =>
      computeDerivation({
        formula: DERIVATION_FORMULA.TURNOVER_RATE,
        operands: { departures, atStart, atEnd },
      });

    it('divides departures by the average of the two headcounts', () => {
      // 12 ÷ ((100 + 80) ÷ 2) = 12 ÷ 90
      expect(Number(turnover('12', '100', '80'))).toBeCloseTo(0.13333333, 8);
    });

    it('averages rather than taking either end — the two are only equal on a flat year', () => {
      // The whole point of three inputs. Against `departures ÷ atEnd` this is 0.15, and against
      // `departures ÷ atStart` it is 0.12; the answer is neither.
      const rate = Number(turnover('12', '100', '80'));
      expect(rate).not.toBeCloseTo(12 / 80, 6);
      expect(rate).not.toBeCloseTo(12 / 100, 6);
    });

    it('answers null while any of the three is unanswered, rather than treating it as zero', () => {
      expect(turnover('12', '100', '')).toBeNull();
      expect(
        computeDerivation({
          formula: DERIVATION_FORMULA.TURNOVER_RATE,
          operands: { departures: '12', atStart: '100', atEnd: null },
        }),
      ).toBeNull();
    });

    it('answers null for an empty workforce rather than dividing by zero', () => {
      // EFRAG's cell shows "-". Dividing anyway yields Infinity, which `numeric` refuses on write.
      expect(turnover('0', '0', '0')).toBeNull();
    });

    it('answers zero — an affirmative nil return — when nobody left a staffed undertaking', () => {
      expect(Number(turnover('0', '100', '80'))).toBe(0);
    });
  });

  describe('B9 — recordable accident rate', () => {
    const rate = (accidents: string, hoursPerFullTimeEmployee: string, employees: string) =>
      computeDerivation({
        formula: DERIVATION_FORMULA.ACCIDENT_RATE,
        operands: { accidents, hoursPerFullTimeEmployee, employees },
      });

    it('is accidents over total hours, scaled by 200 000', () => {
      // 3 ÷ (2000 × 50) × 200000 = 6 — three accidents in a 50-person year reads as 6 per 100
      // workers, which is what the base is for.
      expect(Number(rate('3', '2000', '50'))).toBeCloseTo(6, 10);
    });

    it('scales by 200 000 and not by 100, which a percentage-shaped reading would', () => {
      // The failure this exists for: the element is `numeric`, not `percent`, and a rate expressed
      // per 100 workers is not a percentage of anything. 100 would give 0.003.
      expect(Number(rate('3', '2000', '50'))).not.toBeCloseTo(0.003, 6);
    });

    it('multiplies the hours by the headcount rather than using either alone', () => {
      // Against `accidents ÷ hours × 200000` this is 300; against `accidents ÷ employees × 200000`
      // it is 12 000. Both are wrong by three orders of magnitude and both look like numbers.
      expect(Number(rate('3', '2000', '50'))).toBeLessThan(10);
    });

    it('follows the hours figure, which is the reason it is a question at all', () => {
      // EFRAG: "the undertaking can modify the value… this figure may vary by country or sector."
      // A shorter working year concentrates the same accidents into fewer hours.
      expect(Number(rate('3', '1800', '50'))).toBeGreaterThan(Number(rate('3', '2000', '50')));
    });

    it('answers null on a zero working year rather than filing an infinite rate', () => {
      // **The only guard between a reporter and Infinity** (gate-integrity review, 9 Sep 2026). The
      // hours figure is one `WriteDerivationInputs` accepts a `0` for, and PostgreSQL's `numeric`
      // holds `Infinity` — verified against the running stack — with no `CHECK` on the column to
      // refuse it. Its three sibling formulas each had this case and B9's did not, so removing the
      // guard left every test green while a filing could carry an infinite accident rate marked
      // `origin = 'calculated'`.
      expect(rate('3', '0', '50')).toBeNull();
      expect(rate('3', '2000', '0')).toBeNull();
    });

    it('answers null for a formula kind it does not implement', () => {
      // The branch was an implicit `else` and answered every kind, so a fifth formula whose branch
      // was forgotten computed an accident rate from operands it does not have.
      expect(
        computeDerivation({
          formula: 'not_a_formula' as DerivationFormula,
          operands: { accidents: '3', hoursPerFullTimeEmployee: '2000', employees: '50' },
        }),
      ).toBeNull();
    });

    it('answers null while the headcount is unanswered — B1 is where that comes from', () => {
      expect(rate('3', '2000', '')).toBeNull();
    });

    it('answers zero for a year with no accidents, which is an answer', () => {
      expect(Number(rate('0', '2000', '50'))).toBe(0);
    });
  });


  describe('B10 — the gender pay gap', () => {
    const gap = (reference: string, compared: string) =>
      computeDerivation({
        formula: DERIVATION_FORMULA.RELATIVE_GAP,
        operands: { reference, compared },
      });

    it('is the shortfall against the male figure, over the male figure', () => {
      // EFRAG's D150: (D148 - D149) / D148. (20 - 17) / 20 = 0.15
      expect(Number(gap('20', '17'))).toBeCloseTo(0.15, 10);
    });

    it('divides by the reference, not by the pair’s mean', () => {
      // The symmetric variant answers a different, smaller number for the same two salaries, and
      // a filing carrying it under this element would not be comparable with anyone else's.
      expect(Number(gap('20', '17'))).not.toBeCloseTo(3 / 18.5, 6);
    });

    it('stays signed, because women paid more is a real and reportable state', () => {
      // `Math.abs` here would file *a gap of 15%* on an undertaking that has one the other way,
      // and no reader could tell the two apart.
      expect(Number(gap('17', '20'))).toBeCloseTo(-0.17647059, 6);
    });

    it('answers zero for equal pay, which is an answer rather than a gap unmeasured', () => {
      expect(Number(gap('20', '20'))).toBe(0);
    });

    it('answers null on a zero reference rather than dividing by it', () => {
      expect(gap('0', '17')).toBeNull();
    });

    it('answers null while either figure is unstated', () => {
      expect(gap('20', '')).toBeNull();
    });
  });

  describe('B10 — collective bargaining coverage', () => {
    const share = (part: string, whole: string) =>
      computeDerivation({
        formula: DERIVATION_FORMULA.SHARE_OF_HEADCOUNT,
        operands: { part, whole },
      });

    it('is the covered count over B1’s employee count', () => {
      expect(Number(share('30', '50'))).toBeCloseTo(0.6, 10);
    });

    it('does not average its denominator, which is what separates it from the turnover rate', () => {
      // Two ratios, two formulas, on purpose: `TURNOVER_RATE` averages two points in time and this
      // takes B1's single figure, as EFRAG's own two cells do.
      expect(Number(share('30', '50'))).toBeCloseTo(30 / 50, 10);
    });

    it('answers null on a zero headcount, which EFRAG’s own cell tests for explicitly', () => {
      expect(share('0', '0')).toBeNull();
    });

    it('answers zero where nobody is covered, which is an answer', () => {
      expect(Number(share('0', '50'))).toBe(0);
    });
  });
});

/** FR-30, which had a state, a CHECK, a tone — and no writer — until this task. */
describe('an answered zero is a nil return (FR-30)', () => {
  it('records a zero as a nil return rather than as ok', () => {
    expect(answeredState({ valueNumeric: '0', state: DISCLOSURE_STATE.OK })).toBe(
      DISCLOSURE_STATE.NIL_RETURN,
    );
  });

  it('reads a decimal zero the same way', () => {
    expect(answeredState({ valueNumeric: '0.00', state: DISCLOSURE_STATE.OK })).toBe(
      DISCLOSURE_STATE.NIL_RETURN,
    );
  });

  it('settles the reverse too, so an edited-up field stops being a nil return', () => {
    // The half a one-way rule leaves behind: the browser sending `nil_return` for a 5 would
    // otherwise store a nil return holding five.
    expect(answeredState({ valueNumeric: '5', state: DISCLOSURE_STATE.NIL_RETURN })).toBe(
      DISCLOSURE_STATE.OK,
    );
  });

  it('leaves an unanswered field alone — no value is not a zero', () => {
    expect(answeredState({ valueNumeric: null, state: DISCLOSURE_STATE.MISSING })).toBe(
      DISCLOSURE_STATE.MISSING,
    );
    expect(answeredState({ valueNumeric: '', state: DISCLOSURE_STATE.OK })).toBe(
      DISCLOSURE_STATE.OK,
    );
  });

  it('leaves a deliberate non-answer alone, value or no value', () => {
    // `not_available` carries FR-32's reason and `not_material` is FR-31's exclusion; neither is a
    // statement about a number, so a zero beside one does not make it a nil return.
    expect(
      answeredState({ valueNumeric: '0', state: DISCLOSURE_STATE.NOT_AVAILABLE }),
    ).toBe(DISCLOSURE_STATE.NOT_AVAILABLE);
    expect(answeredState({ valueNumeric: '0', state: DISCLOSURE_STATE.NOT_MATERIAL })).toBe(
      DISCLOSURE_STATE.NOT_MATERIAL,
    );
  });

  it('leaves FR-40’s validation verdicts alone — those are a run’s conclusion, not a value', () => {
    expect(answeredState({ valueNumeric: '0', state: DISCLOSURE_STATE.INCONSISTENCY })).toBe(
      DISCLOSURE_STATE.INCONSISTENCY,
    );
  });
});

/**
 * B3's total and intensity (task 38.4), the two derivations whose operands are all disclosures. **Exact where they
 * can be**: the expected figures were computed outside this code, with Python's `decimal` and `ROUND_HALF_UP`, from a
 * Scope 1 of 0.9699123256 t and a location-based Scope 2 of 10.108965 t over a 5 000 000-leu turnover.
 */
describe('B3 — the emissions total and the GHG intensity (task 38.4)', () => {
  const total = (scope1: string | null, scope2: string | null) =>
    computeDerivation({ formula: DERIVATION_FORMULA.SUM, operands: { scope1, scope2 } });
  const intensity = (scope1: string | null, scope2: string | null, turnover: string | null) =>
    computeDerivation({ formula: DERIVATION_FORMULA.INTENSITY, operands: { scope1, scope2, turnover } });

  it('sums the two scopes exactly — no binary noise in a figure beside its parts', () => {
    expect(total('0.9699123256', '10.108965')).toBe('11.0788773256');
    expect(total('0.1', '0.2')).toBe('0.3');
  });

  it('is no total while either scope is unanswered, rather than counting it as zero', () => {
    expect(total('0.9699123256', null)).toBeNull();
    expect(total(null, null)).toBeNull();
  });

  it('counts a scope answered as zero, which is a nil return', () => {
    expect(total('0', '10.108965')).toBe('10.108965');
  });

  it('divides the scopes’ sum by the turnover, to ten significant figures half-up', () => {
    expect(intensity('0.9699123256', '10.108965', '5000000')).toBe('0.000002215775465');
  });

  it('is no intensity without a turnover, or with a turnover of zero', () => {
    expect(intensity('0.9699123256', '10.108965', null)).toBeNull();
    expect(intensity('0.9699123256', '10.108965', '0')).toBeNull();
    expect(intensity(null, '10.108965', '5000000')).toBeNull();
  });

  it('is no figure from an operand that is not a non-negative decimal', () => {
    expect(total('-1', '2')).toBeNull();
    expect(intensity('1', '2', '-5000000')).toBeNull();
  });
});

/**
 * The Comprehensive Module's derived figures (task 79; §12.5.6's task-79.5, 79.8 and 79.9 rows), against the Digital
 * Template's own cells: `Social Disclosures!D167` for C5's ratio, `Governance Disclosures!H33` for C9's and `H27` for
 * C8's exclusion.
 */
describe('C5 — the female-to-male ratio at management level (task 79.5)', () => {
  const ratio = (numerator: string | null, denominator: string | null) =>
    computeDerivation({ formula: DERIVATION_FORMULA.RATIO, operands: { numerator, denominator } });

  it('divides the female count by the male, as D167 does', () => {
    expect(Number(ratio('3', '4'))).toBeCloseTo(0.75, 12);
  });

  it('is a ratio of zero with no women, which is a nil return', () => {
    expect(ratio('0', '4')).toBe('0');
  });

  it('is no ratio with no men — D167 cannot divide — nor while either count is unanswered', () => {
    expect(ratio('3', '0')).toBeNull();
    expect(ratio(null, '4')).toBeNull();
    expect(ratio('3', null)).toBeNull();
  });
});

describe('C9 — the gender diversity ratio in the governance body (task 79.9)', () => {
  const ratio = (numerator: string | null, denominator: string | null) =>
    computeDerivation({ formula: DERIVATION_FORMULA.GENDER_DIVERSITY_RATIO, operands: { numerator, denominator } });

  it('divides the female members by the male, as H33 does', () => {
    expect(Number(ratio('2', '3'))).toBeCloseTo(2 / 3, 12);
  });

  it('is zero where either count is zero — H33’s IF(OR(H31=0,H32=0),0,…), the owner’s choice', () => {
    expect(ratio('2', '0')).toBe('0');
    expect(ratio('0', '3')).toBe('0');
  });

  it('is no ratio while either count is unanswered, H33’s "-"', () => {
    expect(ratio(null, '3')).toBeNull();
    expect(ratio('2', null)).toBeNull();
  });
});

describe('C8 — exclusion from EU Paris-aligned benchmarks (task 79.8)', () => {
  const excluded = (...answers: (string | null)[]) =>
    computeAffirmation({ operands: Object.fromEntries(answers.map((answer, index) => [`threshold${index}`, answer])) });

  it('is yes as soon as one threshold is yes, whatever the others say or leave unsaid', () => {
    expect(excluded('0', '1', null, '0')).toBe(true);
  });

  it('is no once all four are no — what the template’s "None of the above" says', () => {
    expect(excluded('0', '0', '0', '0')).toBe(false);
  });

  it('is no answer while one is unanswered and none is yes: an unanswered threshold is not a no', () => {
    expect(excluded('0', '0', null, '0')).toBeNull();
    expect(excluded()).toBeNull();
  });

  it('answers in the yes/no column, and asks its inputs yes or no; every other formula a figure and numbers', () => {
    expect(
      derivedAnswer({ formula: DERIVATION_FORMULA.ANY_AFFIRMED, operands: { a: '1', b: '0' } }),
    ).toEqual({ valueNumeric: null, valueBoolean: true });
    expect(
      derivedAnswer({ formula: DERIVATION_FORMULA.SUM, operands: { coal: '10', oil: '0', gas: '5' } }),
    ).toEqual({ valueNumeric: '15', valueBoolean: null });
    expect(inputAnswerOf(DERIVATION_FORMULA.ANY_AFFIRMED)).toBe(INPUT_ANSWER.YES_NO);
    const numbered = Object.values(DERIVATION_FORMULA).filter((formula) => formula !== DERIVATION_FORMULA.ANY_AFFIRMED);
    expect(numbered.map(inputAnswerOf)).toEqual(numbered.map(() => INPUT_ANSWER.NUMBER));
    // A figure formula never answers a yes or a no from the figure path, so nothing can write both columns.
    expect(computeDerivation({ formula: DERIVATION_FORMULA.ANY_AFFIRMED, operands: { a: '1' } })).toBeNull();
  });
});

describe('C8 — the fossil-fuel total (task 79.8)', () => {
  const total = (coal: string | null, oil: string | null, gas: string | null) =>
    computeDerivation({ formula: DERIVATION_FORMULA.SUM, operands: { coal, oil, gas } });

  it('adds coal, oil and gas exactly', () => {
    expect(total('1200.50', '300', '0')).toBe('1500.5');
  });

  it('is no total while any of the three is unanswered — B3’s rule, not the template’s sum of what is entered', () => {
    expect(total('1200.50', null, '0')).toBeNull();
  });
});
