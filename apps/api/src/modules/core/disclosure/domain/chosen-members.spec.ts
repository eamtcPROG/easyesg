import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import { aStoredValue, anElement } from '../testing/step-read.fakes';
import { chosenMembers } from './chosen-members';
import { indexStored } from './stored-values';

/** Task 133.2: the members a report has chosen on a classification axis — a table's rows. */
const POLLUTANT_AXIS = 'TypeOfPollutantAxis';
const AIR = anElement({ key: 'EmissionsToAir', axes: [POLLUTANT_AXIS] });
const WATER = anElement({ key: 'EmissionsToWater', axes: [POLLUTANT_AXIS] });
const HEADCOUNT = anElement({ key: 'NumberOfEmployees' });

const chosen = (
  stored: Parameters<typeof indexStored>[0],
  admitted: readonly string[] = ['AmmoniaMember', 'BenzeneMember', 'MethaneMember'],
) =>
  chosenMembers({
    elements: [AIR, WATER, HEADCOUNT],
    classificationOf: (element: TaxonomyElement) => (element.axes.includes(POLLUTANT_AXIS) ? POLLUTANT_AXIS : null),
    admits: ({ axis, member }) => axis === POLLUTANT_AXIS && admitted.includes(member),
    byElement: indexStored(stored).byElement,
  });

describe('chosenMembers', () => {
  it('gathers the members chosen anywhere on the axis, once each and in a stable order', () => {
    const rows = chosen([
      aStoredValue({ elementKey: 'EmissionsToWater', dimensionKey: 'MethaneMember', valueNumeric: '3' }),
      aStoredValue({ elementKey: 'EmissionsToAir', dimensionKey: 'MethaneMember', valueNumeric: '1' }),
      aStoredValue({ elementKey: 'EmissionsToAir', dimensionKey: 'AmmoniaMember', valueNumeric: '2' }),
    ]);

    // Ammonia chosen only for air is still a row of the table, which water's cell answers too.
    expect(rows.get(POLLUTANT_AXIS)).toEqual(['AmmoniaMember', 'MethaneMember']);
  });

  it('draws no row for a key the axis does not admit, or for a row stored with no member', () => {
    const rows = chosen(
      [
        aStoredValue({ elementKey: 'EmissionsToAir', dimensionKey: 'NotAPollutant', valueNumeric: '1' }),
        aStoredValue({ elementKey: 'EmissionsToAir', dimensionKey: 'BenzeneMember', valueNumeric: '1' }),
        aStoredValue({ elementKey: 'EmissionsToWater', valueNumeric: '4' }),
      ],
      ['BenzeneMember'],
    );

    expect(rows.get(POLLUTANT_AXIS)).toEqual(['BenzeneMember']);
  });

  it('answers an axis nobody has chosen on with no members, and nothing for an element on none', () => {
    const rows = chosen([aStoredValue({ elementKey: 'NumberOfEmployees', valueNumeric: '12' })]);

    expect([...rows]).toEqual([[POLLUTANT_AXIS, []]]);
  });
});
