import { Logger } from '@nestjs/common';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND } from '../constants/disclosure.constants';
import { qualifiedDomainOf } from '../domain/qualified-domain';
import { OfferedMembersService } from './offered-members.service';

/**
 * Which members a choice element offers, as configuration (task 79.7; §12.5.6's task-79.7 row).
 *
 * `AxisShapeService`'s spec in both halves. The first is what the reader does with a payload an operator can publish by
 * mistake; the second holds the **shipped** artefact against the taxonomy versions it names members from — the half that
 * matters, because the artefact is hand-written and its failure is silent by design: a member the domain does not
 * declare makes the entry offer the whole domain, which is C7 offering accident prevention again with every gate green.
 */
describe('OfferedMembersService (task 79.7, AD-4)', () => {
  const build = (payload: unknown, revision = 1) =>
    new OfferedMembersService({
      get: (query: { kind: string; scope: string }) =>
        payload === undefined || query.kind !== DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore);

  let logged: string[] = [];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const offeredBy = (service: OfferedMembersService) =>
    Object.fromEntries(
      [...service.offered({ standard: TAXONOMY_STANDARD.VSME })].map(([element, members]) => [element, [...members]]),
    );

  it('reads each element’s bare members', () => {
    expect(offeredBy(build({ elements: { Rights: ['ChildLabourMember', 'OtherContentMember'] } }))).toEqual({
      Rights: ['ChildLabourMember', 'OtherContentMember'],
    });
    expect(logged).toEqual([]);
  });

  it('narrows nothing where nothing is registered, and says nothing — every domain is offered whole', () => {
    expect(offeredBy(build(undefined))).toEqual({});
    expect(logged).toEqual([]);
  });

  it('fails open on a payload with no elements, loudly — every domain offered whole rather than none', () => {
    expect(offeredBy(build({ rights: [] }))).toEqual({});
    expect(logged).toEqual([expect.stringContaining('carries no `elements` object')]);
  });

  it('drops an entry whole that is not a list of bare member names, and keeps the rest', () => {
    const service = build({
      elements: {
        Rights: ['ChildLabourMember'],
        Empty: [],
        Qualified: ['vsme:ChildLabourMember'],
        Mixed: ['ChildLabourMember', 7],
      },
    });
    expect(offeredBy(service)).toEqual({ Rights: ['ChildLabourMember'] });
    expect(logged).toEqual([expect.stringContaining('Empty, Qualified, Mixed')]);
  });

  it('reads a publication anew and caches by revision', () => {
    let revision = 1;
    let payload: unknown = { elements: { Rights: ['ChildLabourMember'] } };
    const service = new OfferedMembersService({
      get: () => ({ kind: DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND, scope: TAXONOMY_STANDARD.VSME, revision, payload }),
    } as unknown as ConfigurationStore);

    expect(offeredBy(service)).toEqual({ Rights: ['ChildLabourMember'] });
    payload = { elements: { Rights: ['ForcedLabourMember'] } };
    expect(offeredBy(service)).toEqual({ Rights: ['ChildLabourMember'] });
    revision = 2;
    expect(offeredBy(service)).toEqual({ Rights: ['ForcedLabourMember'] });
  });

  describe('the shipped list, against the shipped taxonomy versions', () => {
    const entries = readSeedEntries();
    const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
    const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

    const shipped = () => {
      const entry = entries.find(
        (candidate) =>
          candidate.kind === DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND && candidate.scope === TAXONOMY_STANDARD.VSME,
      );
      expect(entry).toBeDefined();
      return new OfferedMembersService({
        get: (query: { kind: string; scope: string }) =>
          query.kind === DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND && query.scope === TAXONOMY_STANDARD.VSME
            ? { ...entry, revision: 1 }
            : undefined,
      } as unknown as ConfigurationStore);
    };

    it('narrows C7’s rights to the five EFRAG’s template lists, and nothing else', () => {
      // Exact: a second element narrowed is a choice field changing what it offers, which is a decision.
      expect(offeredBy(shipped())).toEqual({
        TypeOfHumanRightRelatedToTheConfirmedIncident: [
          'ChildLabourMember',
          'ForcedLabourMember',
          'HumanTraffickingMember',
          'DiscriminationMember',
          'OtherContentMember',
        ],
      });
      expect(logged).toEqual([]);
    });

    it.each(versions)('%s declares each narrowed element as a choice, and every member it offers in its domain', (version) => {
      const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      expect(taxonomy).not.toBeNull();
      for (const [key, members] of shipped().offered({ standard: TAXONOMY_STANDARD.VSME })) {
        const element = taxonomy?.elements.find((candidate) => candidate.key === key);
        expect({ version, key, declared: element !== undefined }).toEqual({ version, key, declared: true });
        const domain = element === undefined ? null : qualifiedDomainOf(element);
        const enumeration =
          domain === null ? null : registry.enumeration({ standard: TAXONOMY_STANDARD.VSME, version, key: domain });
        const declared = new Set(enumeration?.members.map((member) => member.key) ?? []);
        // A member the domain does not declare makes the entry offer the domain whole — silently, by design.
        expect({ version, key, undeclared: [...members].filter((member) => !declared.has(member)) }).toEqual({
          version,
          key,
          undeclared: [],
        });
        // And narrower than the domain, or the entry says nothing.
        expect(members.size).toBeLessThan(declared.size);
      }
    });
  });
});
