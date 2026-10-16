import type { TaxonomyAxis, TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import {
  DerivedDisclosureNotWritableError,
  NotAvailableReasonRequiredError,
  NotAvailableReasonUnexpectedError,
  UnitNotAdmittedError,
  UnknownDisclosureDimensionError,
  UnknownDisclosureElementError,
} from '../errors/report.errors';
import { DISCLOSURE_STATE, type DisclosureValueContents } from '../models/disclosure-value.model';
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
const AXES = new Map<string, TaxonomyAxis>([
  [ENERGY_AXIS.key, ENERGY_AXIS],
  [POLLUTANT_AXIS.key, POLLUTANT_AXIS],
]);

const ELECTRICITY = anElement({ key: 'EnergyConsumptionFromElectricity', axes: [ENERGY_AXIS.key] });
const EMISSION = anElement({ key: 'AmountOfEmissionToAir', axes: [POLLUTANT_AXIS.key], unitCodes: ['kg', 't'] });
const RATE = anElement({ key: 'RateOfRecordableWorkRelatedAccidents' });
const NAME = anElement({ key: 'NameOfTheUndertaking' });
const KNOWN = new Map<string, TaxonomyElement>([ELECTRICITY, EMISSION, RATE, NAME].map((element) => [element.key, element]));

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

const judged = (value: Partial<ValueToJudge> & Pick<ValueToJudge, 'elementKey'>) =>
  valueRefusal({
    value: { dimensionKey: '', ordinal: 0, contents: contents(), ...value },
    known: KNOWN,
    breakdowns: new Set([ENERGY_AXIS.key]),
    derived: new Set([RATE.key]),
    axisOf: (key) => AXES.get(key) ?? null,
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

  it('refuses a unit the element does not admit', () => {
    const numeric = contents({ valueText: null, valueNumeric: '12', unitCode: 'MWh' });
    expect(judged({ elementKey: EMISSION.key, dimensionKey: 'AlachlorMember', contents: numeric })).toBeInstanceOf(
      UnitNotAdmittedError,
    );
  });
});
