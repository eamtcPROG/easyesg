import type { TaxonomyAxis, TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import {
  BasisForPreparationFollowsScopeError,
  DerivedDisclosureNotWritableError,
  DisclosureOutOfScopeError,
  NotAvailableReasonRequiredError,
  NotAvailableReasonUnexpectedError,
  UnitNotAdmittedError,
  UnknownDisclosureDimensionError,
  UnknownDisclosureElementError,
  YearNotWellFormedError,
} from '../errors/report.errors';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import { DISCLOSURE_STATE, type DisclosureValueContents } from '../models/disclosure-value.model';
import { REPORT_SCOPE, type ReportScope } from '../models/report.model';
import type { TargetAxis } from '../models/target-axis';
import { aMember, anAxis, anElement } from '../testing/step-read.fakes';
import { valueRefusal, type ValueToJudge } from './value-refusal';

/** Task 218: the checks a write makes of each value on its own — every one the value's, none the report's. */
const ENERGY_AXIS = anAxis({
  key: 'BreakdownOfEnergyConsumptionAxis',
  defaultMember: 'TotalRenewableAndNonRenewableEnergyMember',
  members: [aMember({ key: 'RenewableEnergyMember' }), aMember({ key: 'NonRenewableEnergyMember' })],
});
const POLLUTANT_AXIS = anAxis({
  key: 'TypeOfPollutantAxis',
  defaultMember: 'TypeOfPollutantMember',
  members: [aMember({ key: 'AlachlorMember' })],
});
/** `ReportingScopesAxis` — which year, not which scope — and its registration as C3's target axis (task 79.3). */
const SCOPES_AXIS = anAxis({
  key: 'ReportingScopesAxis',
  defaultMember: 'CurrentlyStatedMember',
  members: [
    aMember({ key: 'BaselineYearMember' }),
    aMember({ key: 'TargetYearMember' }),
    aMember({ key: 'CurrentlyStatedMember' }),
  ],
});
const TARGETS = new Map<string, TargetAxis>([
  [SCOPES_AXIS.key, { key: SCOPES_AXIS.key, module: 'C3', base: 'BaselineYearMember', target: 'TargetYearMember' }],
]);
const AXES = new Map<string, TaxonomyAxis>([
  [ENERGY_AXIS.key, ENERGY_AXIS],
  [POLLUTANT_AXIS.key, POLLUTANT_AXIS],
  [SCOPES_AXIS.key, SCOPES_AXIS],
]);

const ELECTRICITY = anElement({ key: 'EnergyConsumptionFromElectricity', axes: [ENERGY_AXIS.key] });
const EMISSION = anElement({ key: 'AmountOfEmissionToAir', axes: [POLLUTANT_AXIS.key], unitCodes: ['kg', 't'] });
const RATE = anElement({ key: 'RateOfRecordableWorkRelatedAccidents' });
const NAME = anElement({ key: 'NameOfTheUndertaking' });
/** A Comprehensive element, and one B3 and C3 share (task 36.4) — task 78.1's two cases. */
const STRATEGY = anElement({ key: 'DescriptionOfBusinessModel', modules: ['C1'] });
const SHARED = anElement({ key: 'GrossScope1GreenhouseGasEmissions', modules: ['B3', 'C3'] });
const BASIS = anElement({ key: 'BasisForPreparation' });
/** B3's Scope 1 on the scopes axis, as the taxonomy carries it, and C3's base year (task 79.3). */
const SCOPE1 = anElement({ key: 'GrossScope1OnTheScopesAxis', modules: ['B3', 'C3'], axes: [SCOPES_AXIS.key] });
const BASE_YEAR = anElement({
  key: 'GreenhouseGasEmissionReductionTargetBaseYear',
  modules: ['C3'],
  kind: DISCLOSURE_KIND.YEAR,
});
const KNOWN = new Map<string, TaxonomyElement>(
  [ELECTRICITY, EMISSION, RATE, NAME, STRATEGY, SHARED, BASIS, SCOPE1, BASE_YEAR].map((element) => [
    element.key,
    element,
  ]),
);
/** The scope's basis as `basisForPreparationOf` answers it for a Basic report. */
const OPTION_A = 'vsme:OptionABasicModuleOnlyMember';

const contents = (over: Partial<DisclosureValueContents> = {}): DisclosureValueContents => ({
  valueNumeric: null,
  valueText: 'Acme',
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  ...over,
});

const judged = (
  value: Partial<ValueToJudge> & Pick<ValueToJudge, 'elementKey'>,
  report: {
    readonly scope?: ReportScope;
    readonly basisForPreparation?: string | null;
    readonly targets?: ReadonlyMap<string, TargetAxis>;
  } = {},
) =>
  valueRefusal({
    value: { dimensionKey: '', ordinal: 0, contents: contents(), ...value },
    known: KNOWN,
    breakdowns: new Set([ENERGY_AXIS.key]),
    targets: report.targets ?? new Map(),
    derived: new Set([RATE.key]),
    axisOf: (key) => AXES.get(key) ?? null,
    scope: report.scope ?? REPORT_SCOPE.BASIC,
    basisForPreparation: report.basisForPreparation === undefined ? OPTION_A : report.basisForPreparation,
  });

describe('valueRefusal', () => {
  it('admits a value every check passes', () => {
    expect(judged({ elementKey: NAME.key })).toBeNull();
  });

  it('refuses a field the pinned version does not name', () => {
    expect(judged({ elementKey: 'NotAnElement' })).toBeInstanceOf(UnknownDisclosureElementError);
  });

  it('admits a breakdown’s total and refuses a member its axes do not declare', () => {
    const numeric = contents({ valueText: null, valueNumeric: '100' });
    expect(
      judged({ elementKey: ELECTRICITY.key, dimensionKey: 'TotalRenewableAndNonRenewableEnergyMember', contents: numeric }),
    ).toBeNull();
    expect(judged({ elementKey: ELECTRICITY.key, dimensionKey: 'WindMember', contents: numeric })).toBeInstanceOf(
      UnknownDisclosureDimensionError,
    );
  });

  it('refuses a classification’s domain head, which is a category', () => {
    const numeric = contents({ valueText: null, valueNumeric: '12', unitCode: 'kg' });
    expect(judged({ elementKey: EMISSION.key, dimensionKey: 'TypeOfPollutantMember', contents: numeric })).toBeInstanceOf(
      UnknownDisclosureDimensionError,
    );
    expect(judged({ elementKey: EMISSION.key, dimensionKey: 'AlachlorMember', contents: numeric })).toBeNull();
  });

  it('refuses a figure the platform derives', () => {
    expect(judged({ elementKey: RATE.key })).toBeInstanceOf(DerivedDisclosureNotWritableError);
  });

  it('refuses not available without a reason, and a reason on any other state', () => {
    expect(
      judged({ elementKey: NAME.key, contents: contents({ valueText: null, state: DISCLOSURE_STATE.NOT_AVAILABLE }) }),
    ).toBeInstanceOf(NotAvailableReasonRequiredError);
    expect(judged({ elementKey: NAME.key, contents: contents({ notAvailableReason: 'Not kept' }) })).toBeInstanceOf(
      NotAvailableReasonUnexpectedError,
    );
  });

  it('refuses a Comprehensive element on a Basic report and admits it once the scope asks it (task 78.1)', () => {
    expect(judged({ elementKey: STRATEGY.key })).toBeInstanceOf(DisclosureOutOfScopeError);
    expect(judged({ elementKey: STRATEGY.key }, { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })).toBeNull();
  });

  it('admits an element B3 and C3 share on a Basic report — it is a Basic element too', () => {
    const numeric = contents({ valueText: null, valueNumeric: '4.2' });
    expect(judged({ elementKey: SHARED.key, contents: numeric })).toBeNull();
  });

  it('admits B1’s basis for preparation only as the scope’s option (task 78.3)', () => {
    expect(judged({ elementKey: BASIS.key, contents: contents({ valueText: OPTION_A }) })).toBeNull();
    for (const refused of [
      contents({ valueText: 'vsme:OptionBBasicModuleAndComprehensiveModuleMember' }),
      contents({ valueText: null }),
      contents({ valueText: null, state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: 'Unknown' }),
    ]) {
      expect(judged({ elementKey: BASIS.key, contents: refused })).toBeInstanceOf(BasisForPreparationFollowsScopeError);
    }
  });

  it('leaves the basis unjudged where the pinned version declares no such member', () => {
    expect(judged({ elementKey: BASIS.key, contents: contents({ valueText: null }) }, { basisForPreparation: null })).toBeNull();
  });

  it('refuses a unit the element does not admit', () => {
    const numeric = contents({ valueText: null, valueNumeric: '12', unitCode: 'MWh' });
    expect(judged({ elementKey: EMISSION.key, dimensionKey: 'AlachlorMember', contents: numeric })).toBeInstanceOf(
      UnitNotAdmittedError,
    );
  });

  describe('a target axis (task 79.3)', () => {
    const numeric = contents({ valueText: null, valueNumeric: '41.8' });
    const comprehensive = { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE, targets: TARGETS };

    it('admits the base and the target year once the scope asks C3', () => {
      for (const dimensionKey of ['BaselineYearMember', 'TargetYearMember']) {
        expect(judged({ elementKey: SCOPE1.key, dimensionKey, contents: numeric }, comprehensive)).toBeNull();
      }
    });

    it('refuses the two years on a Basic report, though the element is B3’s, and admits its reporting year', () => {
      const basic = { scope: REPORT_SCOPE.BASIC, targets: TARGETS };
      expect(
        judged({ elementKey: SCOPE1.key, dimensionKey: 'BaselineYearMember', contents: numeric }, basic),
      ).toBeInstanceOf(DisclosureOutOfScopeError);
      expect(judged({ elementKey: SCOPE1.key, contents: numeric }, basic)).toBeNull();
      // With nothing registered the element is what task 36.4 made it, every row on both modules — which is the shape
      // that admitted a base year on a Basic report until this task.
      expect(
        judged({ elementKey: SCOPE1.key, dimensionKey: 'BaselineYearMember', contents: numeric }, { scope: REPORT_SCOPE.BASIC }),
      ).toBeNull();
    });

    it('refuses the axis’s own currently-stated member, which would be the reporting year written twice', () => {
      expect(
        judged({ elementKey: SCOPE1.key, dimensionKey: 'CurrentlyStatedMember', contents: numeric }, comprehensive),
      ).toBeInstanceOf(UnknownDisclosureDimensionError);
    });
  });

  describe('a year (task 79.3)', () => {
    const comprehensive = { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE };

    it('admits four digits, and a field cleared of its year', () => {
      expect(judged({ elementKey: BASE_YEAR.key, contents: contents({ valueText: '2019' }) }, comprehensive)).toBeNull();
      expect(judged({ elementKey: BASE_YEAR.key, contents: contents({ valueText: null }) }, comprehensive)).toBeNull();
    });

    it.each(['19', '2O19', '2019 ', '20190', '2019-01-01'])('refuses %j, which is not a calendar year', (year) => {
      expect(judged({ elementKey: BASE_YEAR.key, contents: contents({ valueText: year }) }, comprehensive)).toBeInstanceOf(
        YearNotWellFormedError,
      );
    });

    it('judges only the year kind: a text field holding the same characters is an answer', () => {
      expect(judged({ elementKey: NAME.key, contents: contents({ valueText: '19' }) })).toBeNull();
    });
  });
});
