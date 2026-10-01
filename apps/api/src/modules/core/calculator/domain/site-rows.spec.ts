import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { siteAxisElements, siteRows } from './site-rows';

describe('a report’s B1 site rows', () => {
  describe('siteAxisElements', () => {
    const registry = new TaxonomyRegistryService(seedConfigurationStore(readSeedEntries()));

    // Against both shipped versions, because the elements are EFRAG's and a release could move them.
    it.each(['2026-05-01', '2026-02-01'])('finds B1’s five and B5’s three at %s', (version) => {
      const registered = registry.taxonomy({ standard: 'vsme', version });
      expect(registered).not.toBeNull();
      expect([...siteAxisElements(registered!)].sort()).toEqual([
        'AddressOfSite',
        'AreaOfSiteInBiodiversitySensitiveArea',
        'CityOfSite',
        'CountryOfSite',
        'GPSLocationOfSite',
        'PostalCodeOfSite',
        'SiteLocatedInABiodiversitySensitiveArea',
        'SiteLocatedNearABiodiversitySensitiveArea',
      ]);
    });

    it('answers none for a version with no site address', () => {
      expect(siteAxisElements({ standard: 'vsme', version: 'x', modules: [], elements: [], enumerations: [] })).toEqual([]);
    });
  });

  describe('siteRows', () => {
    it('counts each site the snapshot holds, before anyone answers it', () => {
      expect([...siteRows({ answered: [], snapshotSites: 2 })]).toEqual([0, 1]);
    });

    it('adds a site the reporter added beyond the snapshot', () => {
      expect([...siteRows({ answered: [0, 2], snapshotSites: 2 })].sort()).toEqual([0, 1, 2]);
    });

    it('holds no row for a report with no site at all', () => {
      expect(siteRows({ answered: [], snapshotSites: 0 }).size).toBe(0);
    });
  });
});
