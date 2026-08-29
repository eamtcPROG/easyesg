import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TaxonomyRegistryService } from './taxonomy-registry.service';
import { VSME_TAXONOMY_CONFIG_KIND } from '../constants/taxonomy.constants';

/**
 * The registry over the configuration store (FR-65, FR-66, AD-4).
 *
 * **The first test is task 33.1's deliverable stated as a test** — *adding an element needs no code
 * change* — because that sentence is otherwise only a claim in a plan. Everything after it is a way
 * the claim could be true in form and false in practice: a version that reads as unregistered, an
 * element silently dropped, an axis whose members live in another artefact and never arrive.
 *
 * The store is stubbed at its two read methods rather than constructed, because a real
 * `ConfigurationStore` needs a `DataSource` and this suite exists to run without one — following
 * `organization-vocabulary.service.spec.ts`.
 */
describe('TaxonomyRegistryService (FR-65, FR-66)', () => {
  type Entry = { kind: string; scope: string; payload: Record<string, unknown>; revision?: number };

  const build = (entries: Entry[]) => {
    const withRevision = entries.map((entry) => ({ revision: 1, ...entry }));
    const store = {
      get: (query: { kind: string; scope: string }) =>
        withRevision.find((entry) => entry.kind === query.kind && entry.scope === query.scope),
      list: (query: { kind: string }) => withRevision.filter((entry) => entry.kind === query.kind),
    } as unknown as ConfigurationStore;
    return new TaxonomyRegistryService(store);
  };

  const element = (over: Record<string, unknown> = {}) => ({
    module: 'B3',
    section: '[1090] B3 - Environment',
    order: 1,
    parent: null,
    kind: 'numeric',
    xbrlType: 'dtr-types:energyItemType',
    periodType: 'duration',
    ...over,
  });

  const version = (payload: Record<string, unknown>, scope = '2026-05-01'): Entry => ({
    kind: VSME_TAXONOMY_CONFIG_KIND,
    scope,
    payload: { modules: ['B3'], axes: {}, ...payload },
  });

  beforeAll(() => {
    // The malformed paths log at `error` on purpose. Silenced so a deliberate failure does not
    // read as a broken suite.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  describe('a taxonomy version is data', () => {
    it('answers an element registered only in configuration, with no code naming it', () => {
      const registry = build([
        version({ elements: { SomeElementNobodyHasNamedInCode: element() } }),
      ]);

      expect(
        registry.element({
          standard: 'vsme',
          version: '2026-05-01',
          key: 'SomeElementNobodyHasNamedInCode',
        }),
      ).toMatchObject({ key: 'SomeElementNobodyHasNamedInCode', kind: 'numeric', module: 'B3' });
    });

    it('registers two versions side by side, so a pinned report resolves its own (DR-4)', () => {
      const registry = build([
        version({ elements: { Kept: element(), Removed: element() } }, '2026-05-01'),
        version({ elements: { Kept: element() } }, '2029-01-01'),
      ]);

      expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'Removed' })).not.toBeNull();
      expect(registry.element({ standard: 'vsme', version: '2029-01-01', key: 'Removed' })).toBeNull();
      // Newest first, and a plain string sort is what OQ-45's `YYYY-MM-DD` identifier buys.
      expect(registry.registeredVersions({ standard: 'vsme' })).toEqual(['2029-01-01', '2026-05-01']);
    });

    it('reads an unregistered version as null rather than as an empty taxonomy', () => {
      const registry = build([version({ elements: { Kept: element() } })]);
      expect(registry.taxonomy({ standard: 'vsme', version: '2029-01-01' })).toBeNull();
    });
  });

  describe('which version a new report pins (FR-66)', () => {
    const pin = (payload: Record<string, unknown>): Entry => ({
      kind: 'reporting_taxonomy',
      scope: 'vsme',
      payload,
    });

    it('is the registered adoption, not the newest registered version', () => {
      const registry = build([
        version({ elements: {} }, '2026-05-01'),
        version({ elements: {} }, '2029-01-01'),
        pin({ standard: 'vsme', version: '2026-05-01', templateVersion: '2026-05-01' }),
      ]);

      // The whole point of the separate artefact: `2029-01-01` is registered and readable, and a
      // report opened today is still pinned to the version this platform has adopted.
      expect(registry.pinFor({})).toEqual({
        standard: 'vsme',
        taxonomyVersion: '2026-05-01',
        templateVersion: '2026-05-01',
      });
    });

    it('refuses to guess when nothing is registered', () => {
      expect(build([version({ elements: {} })]).pinFor({})).toBeNull();
    });

    it('refuses to guess when the entry is malformed', () => {
      const registry = build([pin({ standard: 'vsme', version: 7, templateVersion: '2026-05-01' })]);
      expect(registry.pinFor({})).toBeNull();
    });
  });

  describe('a malformed payload', () => {
    it('drops one unreadable element and keeps the rest', () => {
      const registry = build([
        version({
          elements: { Good: element(), Bad: element({ kind: 'not-a-kind' }) },
        }),
      ]);

      expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'Good' })).not.toBeNull();
      expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'Bad' })).toBeNull();
    });

    /**
     * The opposite choice from the NACE classifier's, and deliberately so. There, one bad row must
     * not remove 995 good ones from a picker. Here, answering with a partial taxonomy would let a
     * report be authored against one shape and re-read against another.
     */
    it('reads a version whose elements are not a map as unregistered, not as empty', () => {
      const registry = build([version({ elements: 'not a map' })]);
      expect(registry.taxonomy({ standard: 'vsme', version: '2026-05-01' })).toBeNull();
    });
  });

  describe('axes', () => {
    it('orders elements by module and then by the standard’s own order, catch-alls last', () => {
      const registry = build([
        version({
          modules: ['B1', 'B3'],
          elements: {
            ThirdInB3: element({ module: 'B3', order: 2 }),
            SecondInB3: element({ module: 'B3', order: 1 }),
            FirstInB1: element({ module: 'B1', order: 1 }),
            // The standard's pillar-level catch-alls carry no module. `indexOf` answering -1 would
            // sort them ahead of B1, which is the bug this case exists for.
            PillarCatchAll: element({ module: null, order: 1 }),
          },
        }),
      ]);

      expect(
        registry.taxonomy({ standard: 'vsme', version: '2026-05-01' })?.elements.map((e) => e.key),
      ).toEqual(['FirstInB1', 'SecondInB3', 'ThirdInB3', 'PillarCatchAll']);
    });

    it('resolves a domain published in another taxonomy, so no caller learns of the second artefact', () => {
      const registry = build([
        version({
          elements: {},
          axes: {
            TypeOfWasteAxis: {
              typed: false,
              domain: 'W-WasteCategoriesMember',
              domainTaxonomy: 'waste',
              domainVersion: '2026-05-01',
              defaultMember: null,
              members: [],
            },
          },
        }),
        {
          kind: 'vsme_waste_classification',
          scope: '2026-05-01',
          payload: {
            members: {
              'W-20-MunicipalWastesMember': { code: '20', order: 1, labels: { en: 'Municipal' } },
              'W-200301-Non-Hazardous-MixedMunicipalWasteMember': {
                code: '20 03 01',
                hazardous: false,
                order: 2,
                labels: { en: 'Mixed municipal waste' },
              },
            },
          },
        },
      ]);

      const axis = registry.axis({ standard: 'vsme', version: '2026-05-01', key: 'TypeOfWasteAxis' });
      expect(axis?.members).toEqual([
        { key: 'W-20-MunicipalWastesMember', code: '20', hazardous: null, labels: { en: 'Municipal' } },
        {
          key: 'W-200301-Non-Hazardous-MixedMunicipalWasteMember',
          code: '20 03 01',
          hazardous: false,
          labels: { en: 'Mixed municipal waste' },
        },
      ]);
    });

    /**
     * `null` and `false` are different answers and B7 reports on the second: a chapter carries no
     * hazard classification, its six-digit entries do. Folding the two would make every chapter
     * read as non-hazardous.
     */
    it('keeps “not stated at this level” distinct from “classified non-hazardous”', () => {
      const registry = build([
        version({
          elements: {},
          axes: {
            A: { typed: false, domainTaxonomy: 'waste', domainVersion: '1', members: [] },
          },
        }),
        {
          kind: 'vsme_waste_classification',
          scope: '1',
          payload: {
            members: {
              Chapter: { code: '20', order: 1, labels: { en: 'x' } },
              Entry: { code: '20 03 01', hazardous: false, order: 2, labels: { en: 'y' } },
            },
          },
        },
      ]);

      const members = registry.axis({ standard: 'vsme', version: '2026-05-01', key: 'A' })?.members;
      expect(members?.map((m) => m.hazardous)).toEqual([null, false]);
    });

    it('leaves an axis empty and says so when its external domain is not registered', () => {
      const registry = build([
        version({
          elements: {},
          axes: { A: { typed: false, domainTaxonomy: 'waste', domainVersion: '9', members: [] } },
        }),
      ]);
      expect(registry.axis({ standard: 'vsme', version: '2026-05-01', key: 'A' })?.members).toEqual([]);
    });

    it('carries a typed axis with no members, which is what makes it a repeating group', () => {
      const registry = build([
        version({
          elements: {},
          axes: { IdentifierOfSiteTypedAxis: { typed: true, defaultMember: null, members: [] } },
        }),
      ]);
      const axis = registry.axis({
        standard: 'vsme',
        version: '2026-05-01',
        key: 'IdentifierOfSiteTypedAxis',
      });
      expect(axis).toMatchObject({ typed: true, members: [] });
    });
  });

  it('rebuilds its cache when a revision is published, and not otherwise', () => {
    const entries: Entry[] = [{ ...version({ elements: { First: element() } }), revision: 1 }];
    const store = {
      get: (query: { kind: string; scope: string }) =>
        entries.find((entry) => entry.kind === query.kind && entry.scope === query.scope),
      list: () => entries,
    } as unknown as ConfigurationStore;
    const registry = new TaxonomyRegistryService(store);

    expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'First' })).not.toBeNull();

    // A publication is a new revision, which is a new cache key — no invalidation logic.
    entries[0] = { ...version({ elements: { Second: element() } }), revision: 2 };
    expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'First' })).toBeNull();
    expect(registry.element({ standard: 'vsme', version: '2026-05-01', key: 'Second' })).not.toBeNull();
  });
});
