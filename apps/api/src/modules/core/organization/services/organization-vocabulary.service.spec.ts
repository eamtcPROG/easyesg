import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { OrganizationVocabularyService } from './organization-vocabulary.service';

/**
 * The configuration half of FR-14 and FR-15 — **and the part of NFR-9 that a gate can hold**.
 *
 * NFR-9's own verification is a staging demonstration ("a fourth relationship type registered as
 * data"), which no CI job can perform. What *is* checkable here is the property that makes the
 * demonstration possible: the vocabulary is read from the store at request time, so registering a
 * fourth type changes the answer with no code, no schema and no restart. The first test below is
 * that claim, stated as a test rather than as a comment.
 *
 * The store is stubbed at its two read methods rather than constructed, because building a real
 * `ConfigurationStore` needs a `DataSource` — and this suite exists precisely to run without one.
 */
describe('OrganizationVocabularyService (FR-14, FR-15, NFR-9)', () => {
  const build = (entries: { kind: string; scope: string; payload: Record<string, unknown> }[]) => {
    const withRevision = entries.map((entry) => ({ ...entry, revision: 1 }));
    const store = {
      get: (kind: string, scope: string) =>
        withRevision.find((entry) => entry.kind === kind && entry.scope === scope),
      list: (kind: string) => withRevision.filter((entry) => entry.kind === kind),
    } as unknown as ConfigurationStore;
    return new OrganizationVocabularyService(store);
  };

  const legalForms = (scope: string, forms: unknown) => ({
    kind: 'organization_legal_form',
    scope,
    payload: { forms },
  });
  const relationshipTypes = (types: unknown) => ({
    kind: 'organization_relationship_type',
    scope: 'global',
    payload: { types },
  });

  beforeAll(() => {
    // The malformed-payload paths log at `error` on purpose. Silenced so an intentional failure
    // does not read as a broken suite.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => jest.restoreAllMocks());

  describe('relationship types (NFR-9)', () => {
    it('admits a fourth type the moment it is registered, with no code change', () => {
      const before = build([relationshipTypes(['direct_sme'])]);
      const after = build([relationshipTypes(['direct_sme', 'advisor'])]);

      // The whole of NFR-9's obligation that code can carry: nothing between these two lines is a
      // migration, a redeploy or an `as const`. It is the same class reading a different payload.
      expect(before.relationshipTypes()).toEqual(['direct_sme']);
      expect(after.relationshipTypes()).toEqual(['direct_sme', 'advisor']);
    });

    it('admits nothing when the vocabulary is unregistered — fail-closed', () => {
      expect(build([]).relationshipTypes()).toEqual([]);
    });

    it('admits nothing when the payload is malformed, rather than spreading a string', () => {
      // `{"types": "direct_sme"}` cast instead of validated would spread into ten single-character
      // types and admit `d` — a wrong answer that looks like a working one.
      expect(build([relationshipTypes('direct_sme')]).relationshipTypes()).toEqual([]);
    });
  });

  describe('legal forms (FR-15)', () => {
    it('answers the forms registered for a country, case-insensitively', () => {
      const service = build([legalForms('md', ['srl', 'sa'])]);

      expect(service.legalFormsFor('MD')).toEqual(['srl', 'sa']);
      expect(service.legalFormsFor('md')).toEqual(['srl', 'sa']);
    });

    it('answers null for a country registering nothing, distinctly from an empty list', () => {
      const service = build([legalForms('md', [])]);

      // §7.2's boundary: null means the platform does not operate there, empty means it does and
      // the configuration is wrong. Collapsing them would make an editing mistake read as a limit.
      expect(service.legalFormsFor('FR')).toBeNull();
      expect(service.legalFormsFor('MD')).toEqual([]);
    });

    it('answers null for a malformed payload, treating the country as unsupported', () => {
      expect(build([legalForms('md', { srl: true })]).legalFormsFor('MD')).toBeNull();
    });

    it('lists every country that registers a readable vocabulary, with its forms', () => {
      const service = build([
        legalForms('ro', ['sa']),
        legalForms('md', ['srl']),
        legalForms('fr', 'sarl'),
      ]);

      // Sorted, so the order S-04 renders its country field in does not depend on the order rows
      // came back in. The malformed one is excluded rather than logged again — offering a country
      // whose vocabulary cannot be read would be a choice that refuses on submit.
      //
      // The forms travel with the scope: returning bare codes sent the caller back through
      // `legalFormsFor` to re-read payloads this filter had already parsed.
      expect(service.registeredLegalForms()).toEqual([
        { countryCode: 'md', legalForms: ['srl'] },
        { countryCode: 'ro', legalForms: ['sa'] },
      ]);
    });
  });
});
