import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { VSME_TAXONOMY_CONFIG_KIND, VSME_TAXONOMY_MAPPING_CONFIG_KIND } from './constants/taxonomy.constants';
import { mappingScope, readVersionMapping, structuralChanges } from './domain/version-mapping';
import { TaxonomyRegistryService } from './services/taxonomy-registry.service';

/**
 * The seeded mappings against the seeded taxonomies (task 67.17; 182/39, 182/40). **Every pair of consecutive
 * registered versions carries a mapping**, so a migration run never meets a pair with no determination; **each lists
 * at least the fields whose shape differs**, so a version extracted with a removed or retyped element cannot ship
 * beside a mapping that says nothing of it. A field altered in meaning under an unchanged shape is the operator's to
 * add — which this spec admits, since the structural list is a floor, not the whole.
 */
describe('the seeded taxonomy mappings (task 67.17)', () => {
  const entries = readSeedEntries();
  const store = seedConfigurationStore(entries);
  const registry = new TaxonomyRegistryService(store);
  const elementsOf = (version: string) =>
    (entries.find((entry) => entry.kind === VSME_TAXONOMY_CONFIG_KIND && entry.scope === version)?.payload as {
      elements: Record<string, Record<string, unknown>>;
    }).elements;
  const versions = [...registry.registeredVersions({ standard: 'vsme' })].sort();
  const pairs = versions.slice(1).map((to, index) => ({ from: versions[index], to }));

  it('finds pairs to check at all', () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  it.each(pairs)('maps $from to $to, every structural change listed, its determination admitted', (pair) => {
    const mapping = registry.mapping({ standard: 'vsme', ...pair });
    expect(mapping).not.toBeNull();
    const listed = new Map(mapping?.fields.map((field) => [field.element, field.change]));
    for (const change of structuralChanges({ from: elementsOf(pair.from), to: elementsOf(pair.to) })) {
      expect([change.element, listed.get(change.element)]).toEqual([change.element, change.change]);
    }
  });

  it('holds no mapping the registry would not read', () => {
    for (const entry of entries.filter((candidate) => candidate.kind === VSME_TAXONOMY_MAPPING_CONFIG_KIND)) {
      const mapping = readVersionMapping(entry.payload);
      expect(mapping).not.toBeNull();
      expect(entry.scope).toBe(mappingScope(mapping ?? { from: '', to: '' }));
    }
  });
});
