import { DERIVATION_FORMULA, computeDerivation } from './derivation.model';
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

    it('answers null while the headcount is unanswered — B1 is where that comes from', () => {
      expect(rate('3', '2000', '')).toBeNull();
    });

    it('answers zero for a year with no accidents, which is an answer', () => {
      expect(Number(rate('0', '2000', '50'))).toBe(0);
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
