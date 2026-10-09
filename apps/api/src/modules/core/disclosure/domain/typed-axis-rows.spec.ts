import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import type { DisclosureDefault } from '../models/wizard-step.model';
import { aStoredValue, anElement } from '../testing/step-read.fakes';
import type { EntityDefaults } from './entity-defaults';
import { indexStored } from './stored-values';
import { answeredRows, withRecordSiteNames, type AxisRows } from './typed-axis-rows';

/** Task 133.2: a typed axis's rows and their names — the sites B1 and B5 share. */
const SITE_AXIS = 'IdentifierOfSiteTypedAxis';

const site = (key: string, kind: TaxonomyElement['kind'] = DISCLOSURE_KIND.TEXT): TaxonomyElement =>
  anElement({ key, kind, axes: [SITE_AXIS] });

const text = (valueText: string): DisclosureDefault => ({
  valueText,
  valueNumeric: null,
  valueBoolean: null,
  valueDate: null,
});

// Presentation order: the address names a site before its city, and its city before its coordinates.
const ADDRESS = site('AddressOfSite');
const CITY = site('CityOfSite');
const GPS = site('GPSLocationOfSite');
const BIODIVERSITY = site('SiteLocatedInABiodiversitySensitiveArea', DISCLOSURE_KIND.ENUMERATION);

const rowsOf = (input: {
  readonly elements: readonly TaxonomyElement[];
  readonly stored?: Parameters<typeof indexStored>[0];
  readonly defaults?: EntityDefaults;
}): AxisRows | undefined =>
  answeredRows({
    elements: input.elements,
    typedAxisOf: (element) => (element.axes.includes(SITE_AXIS) ? SITE_AXIS : null),
    byElement: indexStored(input.stored ?? []).byElement,
    defaults: input.defaults ?? new Map(),
  }).get(SITE_AXIS);

describe('answeredRows', () => {
  it('gives the axis a row wherever any element on it is answered', () => {
    const rows = rowsOf({
      elements: [ADDRESS, CITY],
      stored: [
        aStoredValue({ elementKey: 'AddressOfSite', ordinal: 0, valueText: 'Str. Unu' }),
        aStoredValue({ elementKey: 'CityOfSite', ordinal: 2, valueText: 'Bălți' }),
      ],
    });

    expect([...(rows?.ordinals ?? [])].sort()).toEqual([0, 2]);
  });

  it('counts the snapshot’s rows for the whole axis, not only the element they default', () => {
    const rows = rowsOf({
      elements: [ADDRESS, CITY],
      defaults: new Map([['AddressOfSite', [text('Str. Unu'), text('Str. Doi')]]]),
    });

    expect([...(rows?.ordinals ?? [])].sort()).toEqual([0, 1]);
  });

  it('names a site by the first text element in presentation order that says something about it', () => {
    const rows = rowsOf({
      elements: [ADDRESS, CITY, GPS],
      stored: [
        aStoredValue({ elementKey: 'GPSLocationOfSite', valueText: '47.0105, 28.8638' }),
        aStoredValue({ elementKey: 'CityOfSite', valueText: 'Chișinău' }),
        aStoredValue({ elementKey: 'AddressOfSite', valueText: 'Str. Unu' }),
      ],
    });

    expect(rows?.names.get(0)).toBe('Str. Unu');
  });

  it('takes the stored answer over the default for the same element — a cleared one included', () => {
    const rows = rowsOf({
      elements: [ADDRESS, CITY],
      defaults: new Map([
        ['AddressOfSite', [text('Str. Propusă'), text('Str. Doi')]],
        ['CityOfSite', [text('Chișinău'), null]],
      ]),
      stored: [aStoredValue({ elementKey: 'AddressOfSite', ordinal: 0, valueText: '' })],
    });

    // The reporter cleared the first site's address: the snapshot's proposal no longer names it, and its city does.
    expect(rows?.names.get(0)).toBe('Chișinău');
    expect(rows?.names.get(1)).toBe('Str. Doi');
  });

  it('never names a row by an element that stores a member key, or by a dimensioned row', () => {
    const rows = rowsOf({
      elements: [BIODIVERSITY, ADDRESS],
      stored: [
        aStoredValue({ elementKey: 'SiteLocatedInABiodiversitySensitiveArea', valueText: 'vsme:YesMember' }),
        aStoredValue({ elementKey: 'AddressOfSite', ordinal: 3, dimensionKey: 'SomeMember', valueText: 'Str. Trei' }),
      ],
    });

    expect(rows?.names.size).toBe(0);
    expect([...(rows?.ordinals ?? [])]).toEqual([0]);
  });

  it('reads nothing from an element on no typed axis', () => {
    expect(
      answeredRows({
        elements: [anElement({ key: 'NumberOfEmployees' })],
        typedAxisOf: () => null,
        byElement: indexStored([aStoredValue({ elementKey: 'NumberOfEmployees', valueNumeric: '12' })]).byElement,
        defaults: new Map(),
      }).size,
    ).toBe(0);
  });
});

describe('withRecordSiteNames', () => {
  const answered: AxisRows = { ordinals: new Set([0, 1]), names: new Map([[0, 'Str. Unu'], [1, 'Str. Doi']]) };
  const other: AxisRows = { ordinals: new Set([0]), names: new Map([[0, 'Filiala']]) };
  const rows = new Map([
    [SITE_AXIS, answered],
    ['IdentifierOfSubsidiaryTypedAxis', other],
  ]);

  it('lays the company’s name for a site over the one the answers gave, and touches nothing else', () => {
    const named = withRecordSiteNames({ rows, siteAxis: SITE_AXIS, names: new Map([[1, 'Depozitul central']]) });

    expect(named.get(SITE_AXIS)).toEqual({
      ordinals: answered.ordinals,
      names: new Map([
        [0, 'Str. Unu'],
        [1, 'Depozitul central'],
      ]),
    });
    expect(named.get('IdentifierOfSubsidiaryTypedAxis')).toBe(other);
    // The rows it was given are not rewritten in place.
    expect(answered.names.get(1)).toBe('Str. Doi');
  });

  it('answers the rows unchanged where there is no site axis, no row on it, or no name to give', () => {
    expect(withRecordSiteNames({ rows, siteAxis: undefined, names: new Map([[0, 'Depozit']]) })).toBe(rows);
    expect(withRecordSiteNames({ rows, siteAxis: 'UnregisteredAxis', names: new Map([[0, 'Depozit']]) })).toBe(rows);
    expect(withRecordSiteNames({ rows, siteAxis: SITE_AXIS, names: new Map() })).toBe(rows);
  });
});
