import { siteNames } from './site-names';

const SITE_AXIS = 'IdentifierOfSiteTypedAxis';
const field = (input: { elementKey: string; ordinal: number; dimensionLabel: string | null; axes?: string[] }) => ({
  axes: [SITE_AXIS],
  ...input,
});

describe('siteNames (task 39.1)', () => {
  it('names each site row by the label the wizard serves for it', () => {
    const names = siteNames({
      addressElement: 'AddressOfSite',
      fields: [
        field({ elementKey: 'AddressOfSite', ordinal: 0, dimensionLabel: 'Str. Alba Iulia 21, Chișinău' }),
        field({ elementKey: 'CityOfSite', ordinal: 0, dimensionLabel: 'Str. Alba Iulia 21, Chișinău' }),
        field({ elementKey: 'AddressOfSite', ordinal: 1, dimensionLabel: 'Str. Ștefan cel Mare 4, Cahul' }),
      ],
    });
    expect([...names]).toEqual([
      [0, 'Str. Alba Iulia 21, Chișinău'],
      [1, 'Str. Ștefan cel Mare 4, Cahul'],
    ]);
  });

  it('leaves out a row nothing names, and reads no field off the site axis', () => {
    const names = siteNames({
      addressElement: 'AddressOfSite',
      fields: [
        field({ elementKey: 'AddressOfSite', ordinal: 0, dimensionLabel: null }),
        field({ elementKey: 'NameOfTheSubsidiary', ordinal: 0, dimensionLabel: 'A subsidiary', axes: ['Other'] }),
      ],
    });
    expect(names.size).toBe(0);
  });

  it('answers nothing when the step carries no address element to find the axis by', () => {
    expect(siteNames({ addressElement: 'AddressOfSite', fields: [] }).size).toBe(0);
  });
});
