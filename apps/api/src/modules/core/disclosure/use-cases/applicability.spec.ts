import {
  APPLICABILITY_CONDITION,
  type ApplicabilityRule,
} from '../models/applicability.model';
import { DISCLOSURE_STATE, type DisclosureValue } from '../models/disclosure-value.model';
import { evaluateApplicability, soleCause, type MemberAncestry } from './applicability';

/**
 * FR-28's evaluation, at and either side of every boundary (task 91.3; BR-APP-1 … BR-APP-5).
 *
 * **No database, no registry, no HTTP** — which is the point of the evaluator being pure. The
 * thresholds a browser journey can only reach by contriving a report are one line each here.
 */

const HEADCOUNT = 'NumberOfEmployees';
const TURNOVER_RATE = 'EmployeeTurnoverRate';
const PAY_GAP = 'PercentageGapInPayBetweenFemaleAndMaleEmployees';
const ACTIVITY = 'NaceSectorClassificationCodes';
const SITE_CITY = 'CityOfSite';
const SITE_GPS = 'GPSLocationOfSite';
const BIODIVERSITY = 'SiteLocatedInABiodiversitySensitiveArea';
const WATER = 'TotalWaterConsumption';

const value = (over: Partial<DisclosureValue> & { elementKey: string }): DisclosureValue => ({
  id: '01930000-0000-7000-8000-000000000001',
  reportId: '01930000-0000-7000-8000-0000000000ff',
  dimensionKey: '',
  ordinal: 0,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const answers = (...values: DisclosureValue[]): ReadonlyMap<string, readonly DisclosureValue[]> => {
  const byElement = new Map<string, DisclosureValue[]>();
  for (const entry of values) byElement.set(entry.elementKey, [...(byElement.get(entry.elementKey) ?? []), entry]);
  return byElement;
};

const atLeastRule = (threshold: string, element: string): ApplicabilityRule => ({
  elements: [element],
  condition: { kind: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST, elementKey: HEADCOUNT, threshold },
});

const siteRule: ApplicabilityRule = {
  elements: [BIODIVERSITY],
  condition: { kind: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED, elementKeys: [SITE_CITY, SITE_GPS] },
};

const waterRule: ApplicabilityRule = {
  elements: [WATER],
  condition: {
    kind: APPLICABILITY_CONDITION.MEMBER_WITHIN,
    elementKey: ACTIVITY,
    members: ['nace:NACE_A', 'nace:NACE_C'],
  },
};

/** Two branches of the real classification, three levels deep, as the artefact carries them. */
const NACE: MemberAncestry = new Map<string, string | null>([
  ['nace:NACE_A', null],
  ['nace:NACE_A01', 'nace:NACE_A'],
  ['nace:NACE_A011', 'nace:NACE_A01'],
  ['nace:NACE_A0111', 'nace:NACE_A011'],
  ['nace:NACE_C', null],
  ['nace:NACE_C10', 'nace:NACE_C'],
  ['nace:NACE_C107', 'nace:NACE_C10'],
  ['nace:NACE_C1071', 'nace:NACE_C107'],
  ['nace:NACE_G', null],
  ['nace:NACE_G47', 'nace:NACE_G'],
  ['nace:NACE_G4711', 'nace:NACE_G47'],
]);

const evaluate = (rules: readonly ApplicabilityRule[], values: DisclosureValue[]) =>
  evaluateApplicability({ rules, answers: answers(...values), ancestry: NACE });

describe('evaluateApplicability (task 91.3; FR-28)', () => {
  describe('a headcount threshold (BR-APP-1, BR-APP-2)', () => {
    const rules = [atLeastRule('50', TURNOVER_RATE), atLeastRule('150', PAY_GAP)];

    it.each([
      ['49', false, false],
      ['50', true, false],
      ['149', true, false],
      ['150', true, true],
      ['151', true, true],
    ])('at %s employees the turnover rate is %s and the pay gap %s', (headcount, turnover, gap) => {
      const evaluated = evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: headcount })]);
      expect(evaluated.get(TURNOVER_RATE)?.applicable).toBe(turnover);
      expect(evaluated.get(PAY_GAP)?.applicable).toBe(gap);
    });

    it('names the cause: who was read, what they answered and what it takes', () => {
      const evaluated = evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: '40' })]);
      expect(evaluated.get(TURNOVER_RATE)?.cause).toEqual({
        condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
        driverKeys: [HEADCOUNT],
        threshold: '50',
        answer: '40',
      });
    });

    it('is inapplicable while the driver is unanswered, and says so with a null answer (UX-9)', () => {
      const evaluated = evaluate(rules, []);
      expect(evaluated.get(TURNOVER_RATE)?.applicable).toBe(false);
      expect(evaluated.get(TURNOVER_RATE)?.cause.answer).toBeNull();

      // A row cleared back to `missing` is not an answer — the same rule the module counts use.
      const cleared = evaluate(rules, [
        value({ elementKey: HEADCOUNT, valueNumeric: '200', state: DISCLOSURE_STATE.MISSING }),
      ]);
      expect(cleared.get(TURNOVER_RATE)?.applicable).toBe(false);
    });

    it('compares decimals exactly, never as floats (NFR-58)', () => {
      const rules = [atLeastRule('49.5', TURNOVER_RATE)];
      expect(evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: '49.50' })]).get(TURNOVER_RATE)?.applicable).toBe(true);
      expect(evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: '49.4999' })]).get(TURNOVER_RATE)?.applicable).toBe(false);
      // Beyond what a double can distinguish: as floats both sides are 10000000000000000.
      const huge = [atLeastRule('10000000000000001', TURNOVER_RATE)];
      expect(evaluate(huge, [value({ elementKey: HEADCOUNT, valueNumeric: '10000000000000000' })]).get(TURNOVER_RATE)?.applicable).toBe(false);
    });

    it('does not satisfy a threshold from an unparseable answer', () => {
      const evaluated = evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: 'many' })]);
      expect(evaluated.get(TURNOVER_RATE)?.applicable).toBe(false);
    });

    it('governs only the elements its rule names', () => {
      const evaluated = evaluate(rules, [value({ elementKey: HEADCOUNT, valueNumeric: '200' })]);
      // An element no rule names is absent, so the read defaults it to applicable with no cause —
      // rather than this returning a verdict for all 143.
      expect(evaluated.has('NumberOfFemaleEmployees')).toBe(false);
      expect([...evaluated.keys()].sort()).toEqual([PAY_GAP, TURNOVER_RATE].sort());
    });
  });

  describe('site-driven biodiversity (BR-APP-3)', () => {
    it('applies once any site row is answered, in any of the site fields', () => {
      expect(evaluate([siteRule], []).get(BIODIVERSITY)?.applicable).toBe(false);
      // A site row carrying only a GPS fix is a site: this is why the condition names five
      // elements rather than nominating an address as the definition of one.
      expect(
        evaluate([siteRule], [value({ elementKey: SITE_GPS, valueText: '47.0105 28.8638' })]).get(BIODIVERSITY)
          ?.applicable,
      ).toBe(true);
    });

    it('applies on a second row when the first was cleared', () => {
      const evaluated = evaluate([siteRule], [
        value({ elementKey: SITE_CITY, ordinal: 0, state: DISCLOSURE_STATE.MISSING }),
        value({ elementKey: SITE_CITY, ordinal: 1, valueText: 'Bălți' }),
      ]);
      expect(evaluated.get(BIODIVERSITY)?.applicable).toBe(true);
    });

    it('quotes no answer, because the condition asks whether rows exist', () => {
      expect(evaluate([siteRule], []).get(BIODIVERSITY)?.cause).toEqual({
        condition: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED,
        driverKeys: [SITE_CITY, SITE_GPS],
        threshold: null,
        answer: null,
      });
    });
  });

  describe('sector-driven water (BR-APP-4)', () => {
    it('accepts a class that descends from a listed section', () => {
      // `10.71` — the bakery in the wizard fixture — is four levels below manufacturing, and the
      // pointed code contains no `C`, which is why this is descent rather than a prefix match.
      const evaluated = evaluate([waterRule], [value({ elementKey: ACTIVITY, valueText: 'nace:NACE_C1071' })]);
      expect(evaluated.get(WATER)?.applicable).toBe(true);
    });

    it('accepts a listed section named directly', () => {
      expect(
        evaluate([waterRule], [value({ elementKey: ACTIVITY, valueText: 'nace:NACE_A' })]).get(WATER)?.applicable,
      ).toBe(true);
    });

    it('refuses an activity under no listed section, and quotes it back', () => {
      const evaluated = evaluate([waterRule], [value({ elementKey: ACTIVITY, valueText: 'nace:NACE_G4711' })]);
      expect(evaluated.get(WATER)?.applicable).toBe(false);
      expect(evaluated.get(WATER)?.cause.answer).toBe('nace:NACE_G4711');
    });

    it('applies when any one of several reported activities qualifies', () => {
      const evaluated = evaluate([waterRule], [
        value({ elementKey: ACTIVITY, valueText: 'nace:NACE_G4711 nace:NACE_C1071' }),
      ]);
      expect(evaluated.get(WATER)?.applicable).toBe(true);
    });

    it('refuses a member the ancestry does not carry rather than walking off the end', () => {
      const evaluated = evaluate([waterRule], [value({ elementKey: ACTIVITY, valueText: 'nace:NACE_Z9999' })]);
      expect(evaluated.get(WATER)?.applicable).toBe(false);
    });

    it('terminates on a cycle in published data', () => {
      const cyclic = new Map<string, string | null>([
        ['nace:NACE_X', 'nace:NACE_Y'],
        ['nace:NACE_Y', 'nace:NACE_X'],
      ]);
      const evaluated = evaluateApplicability({
        rules: [waterRule],
        answers: answers(value({ elementKey: ACTIVITY, valueText: 'nace:NACE_X' })),
        ancestry: cyclic,
      });
      expect(evaluated.get(WATER)?.applicable).toBe(false);
    });
  });

  describe('two rules over one element are a conjunction', () => {
    const satisfied: ApplicabilityRule = { elements: [WATER], condition: waterRule.condition };
    const refused: ApplicabilityRule = { elements: [WATER], condition: atLeastRule('50', WATER).condition };
    const values = [
      value({ elementKey: ACTIVITY, valueText: 'nace:NACE_C1071' }),
      value({ elementKey: HEADCOUNT, valueNumeric: '10' }),
    ];

    // **Both orders, and the second is the one that matters** (gate-integrity review, 3 Sep 2026).
    // With the refusal last, an unconditional `set` — last rule wins, not a conjunction — passes
    // this case; only the refusal-first order can tell the two implementations apart.
    it.each([
      ['the refusal last', [satisfied, refused]],
      ['the refusal first', [refused, satisfied]],
    ])('refuses and reports the refusing rule, with %s', (_order, rules) => {
      const evaluated = evaluate(rules, values);
      expect(evaluated.get(WATER)?.applicable).toBe(false);
      expect(evaluated.get(WATER)?.cause.condition).toBe(APPLICABILITY_CONDITION.NUMERIC_AT_LEAST);
    });

    it('applies only where every rule holds', () => {
      const evaluated = evaluate([refused, satisfied], [
        value({ elementKey: ACTIVITY, valueText: 'nace:NACE_C1071' }),
        value({ elementKey: HEADCOUNT, valueNumeric: '60' }),
      ]);
      expect(evaluated.get(WATER)?.applicable).toBe(true);
    });
  });

  /**
   * What a module announces when every element in it has gone (task 91.3).
   *
   * **Unit cases, because the shipped artefact cannot reach the disagreement branch**: no two of
   * FR-28's four rules govern one module, so an e2e proves only the agreeing half — which is how
   * this logic passed a mutation that always named the first cause (gate-integrity review).
   */
  describe('soleCause', () => {
    const verdict = (threshold: string, answer: string) =>
      evaluate([atLeastRule(threshold, TURNOVER_RATE)], [
        value({ elementKey: HEADCOUNT, valueNumeric: answer }),
      ]).get(TURNOVER_RATE)!;

    it('answers the one reason when every verdict agrees, however many say it', () => {
      const one = verdict('50', '10');
      expect(soleCause([one, verdict('50', '10'), one])?.cause.threshold).toBe('50');
    });

    it('answers nothing where the reasons differ, rather than naming one of them', () => {
      // Same driver and condition, different thresholds: still two reasons, and a module that
      // vanished for both has no single answer to UX-27's question.
      expect(soleCause([verdict('50', '10'), verdict('150', '10')])).toBeUndefined();
    });

    it('answers nothing for no verdicts at all', () => {
      expect(soleCause([])).toBeUndefined();
    });
  });

  it('governs nothing when no rule is registered', () => {
    expect(evaluate([], [value({ elementKey: HEADCOUNT, valueNumeric: '10' })]).size).toBe(0);
  });
});
