import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_OMISSION_SECTION_CONFIG_KIND } from '../constants/disclosure.constants';
import { moduleOfOmissionMember, OMITTED_DISCLOSURES_ELEMENT } from '../models/omission.model';
import { OmissionSectionsService } from './omission-sections.service';

/**
 * Which elements an omitted section withholds, as configuration (task 41.2; FR-31 AC-3; §12.5.6's task-41 row (4)).
 *
 * The reader's half, including the direction it fails in, and then the **shipped** artefact held against both
 * registered versions — it is written by hand, so a section naming an element EFRAG renamed would withhold nothing,
 * silently, and a section left unmapped would raise `MISSING VALUE` on what a reporter lawfully withheld.
 */
describe('OmissionSectionsService (FR-31)', () => {
  let logged: string[] = [];

  const build = (payload: Record<string, unknown> | undefined, revision = 1) =>
    new OmissionSectionsService({
      get: (query: { kind: string; scope: string }) =>
        payload === undefined || query.kind !== DISCLOSURE_OMISSION_SECTION_CONFIG_KIND
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore);

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads each section with its elements', () => {
    const sections = build({ sections: { B8GenderMember: ['NumberOfMaleEmployees'] } }).sectionsFor({
      standard: TAXONOMY_STANDARD.VSME,
    });
    expect(Object.fromEntries(sections)).toEqual({ B8GenderMember: ['NumberOfMaleEmployees'] });
  });

  it('drops a malformed section alone, so it withholds nothing, and says which', () => {
    const sections = build({ sections: { B8GenderMember: ['NumberOfMaleEmployees'], B8TypeOfContractMember: [] } })
      .sectionsFor({ standard: TAXONOMY_STANDARD.VSME });
    expect([...sections.keys()]).toEqual(['B8GenderMember']);
    expect(logged[0]).toContain('B8TypeOfContractMember');
  });

  it('withholds nothing where the payload is not a map of sections, or nothing is registered', () => {
    expect(build({ sections: ['B8GenderMember'] }).sectionsFor({ standard: TAXONOMY_STANDARD.VSME }).size).toBe(0);
    expect(logged).toHaveLength(1);
    expect(build(undefined).sectionsFor({ standard: TAXONOMY_STANDARD.VSME }).size).toBe(0);
  });
});

describe('the shipped omission sections, against the shipped taxonomy versions', () => {
  const entries = readSeedEntries();
  const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });
  const sections = new OmissionSectionsService(seedConfigurationStore(entries)).sectionsFor({
    standard: TAXONOMY_STANDARD.VSME,
  });

  it.each(versions)('%s: every section of B1’s list is mapped, and only sections are', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    const element = taxonomy?.elements.find((candidate) => candidate.key === OMITTED_DISCLOSURES_ELEMENT);
    const domain = taxonomy?.enumerations.find((candidate) => candidate.key.endsWith(`:${element?.domain ?? ''}`));
    // A section is every member but a module's own, whose hyphen marks it (`moduleOfOmissionMember`).
    const sectionMembers = (domain?.members ?? [])
      .map((member) => member.key)
      .filter((member) => moduleOfOmissionMember(member)?.section !== false);
    expect(sectionMembers.length).toBeGreaterThan(0);
    expect([...sections.keys()].sort()).toEqual([...sectionMembers].sort());
  });

  it.each(versions)('%s: every element a section names exists, and belongs to the module its member names', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    const elements = new Map((taxonomy?.elements ?? []).map((element) => [element.key, element]));
    for (const [member, keys] of sections) {
      const module = moduleOfOmissionMember(member)?.module;
      for (const key of keys) {
        const found = elements.get(key);
        expect({ member, key, declared: found !== undefined }).toEqual({ member, key, declared: true });
        // The four *any other* members belong to no module, and name their own catch-all element.
        if (module !== undefined) expect({ member, key, module: found?.modules.includes(module) }).toEqual({ member, key, module: true });
      }
    }
  });

  it('withholds an element through one section at most', () => {
    const all = [...sections.values()].flat();
    expect(all.length).toBe(new Set(all).size);
  });
});
