import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { B3_ELEMENT_FOR_SCOPE } from './b3-element.model';

describe('the B3 elements a run answers', () => {
  const registry = new TaxonomyRegistryService(seedConfigurationStore(readSeedEntries()));

  it.each(['2026-05-01', '2026-02-01'])('are B3 figures in tonnes of CO₂e at %s', (version) => {
    for (const key of Object.values(B3_ELEMENT_FOR_SCOPE)) {
      expect(registry.element({ standard: 'vsme', version, key })).toMatchObject({
        modules: expect.arrayContaining(['B3']) as unknown,
        unitCodes: ['tCO2e'],
      });
    }
  });

  it('names a distinct element for each scope', () => {
    const elements = Object.values(B3_ELEMENT_FOR_SCOPE);
    expect(new Set(elements).size).toBe(elements.length);
  });
});
