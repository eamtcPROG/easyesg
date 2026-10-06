import { DISCLOSURE_ORIGIN, DISCLOSURE_STATE, type DisclosureValue } from '../models/disclosure-value.model';
import type { EntitySnapshot, SnapshotSite } from '../models/entity-snapshot.model';
import type { DisclosureDefault } from '../models/wizard-step.model';
import { recordSiteNames, showsRecordValue } from './record-provenance';

/** Task 180.3: what in B1 still says what the company record said. No database, no container. */
const text = (valueText: string | null): DisclosureDefault => ({
  valueText,
  valueNumeric: null,
  valueBoolean: null,
  valueDate: null,
});

const stored = (
  over: Partial<DisclosureValue> & Pick<DisclosureValue, 'elementKey'>,
): DisclosureValue => ({
  id: 'v1',
  reportId: 'r1',
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
  origin: DISCLOSURE_ORIGIN.REPORTED,
  explanation: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('showsRecordValue', () => {
  const given = text('vsme:PrivateLimitedLiabilityUndertakingMember');

  it('is the record’s while its default is shown and nothing is stored', () => {
    expect(showsRecordValue({ elementKey: 'UndertakingsLegalForm', value: undefined, given })).toBe(true);
  });

  it('stays the record’s once committed unchanged, and stops being it once the reporter changes it', () => {
    const committed = stored({ elementKey: 'UndertakingsLegalForm', valueText: given.valueText });
    const changed = stored({ elementKey: 'UndertakingsLegalForm', valueText: 'vsme:CooperativeMember' });

    expect(showsRecordValue({ elementKey: 'UndertakingsLegalForm', value: committed, given })).toBe(true);
    expect(showsRecordValue({ elementKey: 'UndertakingsLegalForm', value: changed, given })).toBe(false);
  });

  it('is not the record’s once cleared, whatever the columns still hold', () => {
    const cleared = stored({
      elementKey: 'UndertakingsLegalForm',
      valueText: given.valueText,
      state: DISCLOSURE_STATE.MISSING,
    });

    expect(showsRecordValue({ elementKey: 'UndertakingsLegalForm', value: cleared, given })).toBe(false);
  });

  it('marks nothing the record does not give — an empty default, or none', () => {
    expect(showsRecordValue({ elementKey: 'PostalCodeOfSite', value: undefined, given: text(null) })).toBe(false);
    expect(showsRecordValue({ elementKey: 'PostalCodeOfSite', value: undefined, given: null })).toBe(false);
  });

  it('does not call the report’s own scope, or the template’s answer, the company’s', () => {
    // The basis for preparation defaults from the report's scope; B10's wage flag from EFRAG's template.
    expect(showsRecordValue({ elementKey: 'BasisForPreparation', value: undefined, given: text('vsme:OptionA') })).toBe(
      false,
    );
    expect(
      showsRecordValue({ elementKey: 'EntityPaysWagesAboveMinimum', value: undefined, given: text('true') }),
    ).toBe(false);
  });
});

describe('recordSiteNames', () => {
  const site = (over: Partial<SnapshotSite>): SnapshotSite => ({
    name: 'Bakery and offices',
    addressLine1: 'str. Morii 3',
    locality: 'Soroca',
    postalCode: null,
    countryCode: 'MD',
    latitude: null,
    longitude: null,
    ...over,
  });
  const snapshot = (sites: SnapshotSite[]): EntitySnapshot => ({
    takenAt: new Date('2026-09-30T00:00:00Z'),
    legalForm: 'srl',
    naceCodes: [],
    consolidationBasis: null,
    consolidationMembers: [],
    sites,
  });
  const record = new Map<string, readonly (DisclosureDefault | null)[]>([
    ['AddressOfSite', [text('str. Morii 3'), text('str. Gării 1')]],
    ['CityOfSite', [text('Soroca'), text('Otaci')]],
    ['PostalCodeOfSite', [null, null]],
  ]);
  const twoSites = snapshot([site({}), site({ name: 'Grain store', addressLine1: 'str. Gării 1', locality: 'Otaci' })]);

  it('names each row the record gave by the company’s name for the site, before and after it is committed', () => {
    const committed = new Map([['AddressOfSite', [stored({ elementKey: 'AddressOfSite', valueText: 'str. Morii 3' })]]]);

    expect(recordSiteNames({ snapshot: twoSites, record, stored: new Map() })).toEqual(
      new Map([
        [0, 'Bakery and offices'],
        [1, 'Grain store'],
      ]),
    );
    expect(recordSiteNames({ snapshot: twoSites, record, stored: committed }).get(0)).toBe('Bakery and offices');
  });

  it('gives up the name of a row the reporter re-addressed or cleared, which may no longer be that site', () => {
    const readdressed = new Map([
      ['CityOfSite', [stored({ elementKey: 'CityOfSite', ordinal: 1, valueText: 'Bălți' })]],
    ]);
    const cleared = new Map([
      ['AddressOfSite', [stored({ elementKey: 'AddressOfSite', state: DISCLOSURE_STATE.MISSING })]],
    ]);

    expect([...recordSiteNames({ snapshot: twoSites, record, stored: readdressed }).keys()]).toEqual([0]);
    expect([...recordSiteNames({ snapshot: twoSites, record, stored: cleared }).keys()]).toEqual([1]);
  });

  it('keeps the name when the reporter fills in what the record did not give — that is not a different site', () => {
    const filledIn = new Map([
      ['PostalCodeOfSite', [stored({ elementKey: 'PostalCodeOfSite', valueText: 'MD-3001' })]],
    ]);

    expect(recordSiteNames({ snapshot: twoSites, record, stored: filledIn }).get(0)).toBe('Bakery and offices');
  });

  it('names nothing without a snapshot, and skips a site with a blank name', () => {
    expect(recordSiteNames({ snapshot: null, record, stored: new Map() }).size).toBe(0);
    expect(recordSiteNames({ snapshot: snapshot([site({ name: '  ' })]), record, stored: new Map() }).size).toBe(0);
  });
});
