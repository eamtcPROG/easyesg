import { ENUMERATION_TAXONOMY, type RegisteredTaxonomy } from '@api/contracts/taxonomy-registry.port';
import { CONSOLIDATION_BASIS } from '@api/modules/core/entity/models/reporting-entity.model';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import type { EntitySnapshot } from '../models/entity-snapshot.model';
import { REPORT_SCOPE } from '../models/report.model';
import { B1_DOMAIN, B1_ELEMENT, BASIS_MEMBER, SCOPE_MEMBER, entityDefaults } from './entity-defaults';

/**
 * B1's defaults (task 91.2; FR-27, UX-109, D-2) — every mapping as a unit case, and the pinned
 * names held against the shipped artefacts.
 *
 * The second half is the one that can fail on a re-extraction: `B1_ELEMENT` and the member names
 * are EFRAG's, written here by hand, and a release that renames one would otherwise pre-fill
 * nothing with nothing logged — the shape of failure task 33.1 found in §7.3's invented keys.
 */
const enumeration = (
  key: string,
  members: readonly { readonly key: string; readonly code?: string }[],
): RegisteredTaxonomy['enumerations'][number] => {
  const [taxonomy] = key.split(':');
  return {
    key,
    taxonomy: taxonomy as RegisteredTaxonomy['enumerations'][number]['taxonomy'],
    external: null,
    members: members.map((member) => ({ key: member.key, code: member.code ?? null, hazardous: null, parent: null, labels: {} })),
  };
};

const registered = (
  enumerations: readonly RegisteredTaxonomy['enumerations'][number][],
): RegisteredTaxonomy => ({
  standard: TAXONOMY_STANDARD.VSME,
  version: '2026-05-01',
  modules: ['B1'],
  elements: [],
  enumerations,
});

const FULL = registered([
  enumeration(B1_DOMAIN.BASIS_FOR_PREPARATION, [
    { key: 'OptionABasicModuleOnlyMember' },
    { key: 'OptionBBasicModuleAndComprehensiveModuleMember' },
  ]),
  enumeration(B1_DOMAIN.BASIS_FOR_REPORTING, [{ key: 'IndividualMember' }, { key: 'ConsolidatedMember' }]),
  enumeration(B1_DOMAIN.LEGAL_FORM, [{ key: 'PrivateLimitedLiabilityUndertakingMember' }, { key: 'CooperativeMember' }]),
  enumeration(B1_DOMAIN.ACTIVITY_CODES, [
    { key: 'NACE_C1071', code: '10.71' },
    { key: 'NACE_G4711', code: '47.11' },
  ]),
]);

const snapshot = (over: Partial<EntitySnapshot> = {}): EntitySnapshot => ({
  takenAt: new Date('2026-01-01T00:00:00.000Z'),
  legalForm: 'srl',
  naceCodes: ['10.71'],
  consolidationBasis: null,
  consolidationMembers: [],
  sites: [],
  ...over,
});

const textOf = (
  defaults: ReturnType<typeof entityDefaults>['defaults'],
  key: string,
): readonly (string | null)[] | undefined =>
  defaults.get(key)?.map((row) => (row === null ? null : row.valueText));

describe('entityDefaults (task 91.2; FR-27)', () => {
  it('answers the basis for preparation from the report’s own scope, snapshot or no snapshot', () => {
    const basic = entityDefaults({ registered: FULL, snapshot: null, scope: REPORT_SCOPE.BASIC, legalFormMember: null });
    expect(textOf(basic.defaults, B1_ELEMENT.BASIS_FOR_PREPARATION)).toEqual(['vsme:OptionABasicModuleOnlyMember']);
    // No snapshot: nothing else is defaulted, and nothing is reported as unmapped.
    expect(basic.defaults.size).toBe(1);
    expect(basic.unmappedActivityCodes).toEqual([]);

    const both = entityDefaults({
      registered: FULL,
      snapshot: snapshot(),
      scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
      legalFormMember: null,
    });
    expect(textOf(both.defaults, B1_ELEMENT.BASIS_FOR_PREPARATION)).toEqual([
      'vsme:OptionBBasicModuleAndComprehensiveModuleMember',
    ]);
  });

  it('qualifies the legal-form member the country’s configuration resolved, and omits an unmapped form', () => {
    const mapped = entityDefaults({
      registered: FULL,
      snapshot: snapshot(),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: 'PrivateLimitedLiabilityUndertakingMember',
    });
    expect(textOf(mapped.defaults, B1_ELEMENT.LEGAL_FORM)).toEqual(['vsme:PrivateLimitedLiabilityUndertakingMember']);

    const unmapped = entityDefaults({ registered: FULL, snapshot: snapshot(), scope: REPORT_SCOPE.BASIC, legalFormMember: null });
    expect(unmapped.defaults.has(B1_ELEMENT.LEGAL_FORM)).toBe(false);
  });

  it('serves nothing for a member the pinned version does not declare (DR-4 at the default)', () => {
    // A configuration naming a member this version lacks must not pre-fill what it cannot store.
    const stale = entityDefaults({
      registered: FULL,
      snapshot: snapshot(),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: 'PartnershipMember',
    });
    expect(stale.defaults.has(B1_ELEMENT.LEGAL_FORM)).toBe(false);

    // And a version with no such domain at all defaults none of the choice fields.
    const bare = entityDefaults({
      registered: registered([]),
      snapshot: snapshot({ consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: 'PrivateLimitedLiabilityUndertakingMember',
    });
    expect([...bare.defaults.keys()]).toEqual([]);
    expect(bare.unmappedActivityCodes).toEqual(['10.71']);
  });

  it('maps activity codes by pointed code into one space-separated set, naming the codes that map to nothing', () => {
    const result = entityDefaults({
      registered: FULL,
      snapshot: snapshot({ naceCodes: ['47.11', '99.99', '10.71'] }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: null,
    });
    // The owner's decision on task 91.2: the codes that map are served, in the entity's order.
    expect(textOf(result.defaults, B1_ELEMENT.ACTIVITY_CODES)).toEqual(['nace:NACE_G4711 nace:NACE_C1071']);
    expect(result.unmappedActivityCodes).toEqual(['99.99']);

    const none = entityDefaults({
      registered: FULL,
      snapshot: snapshot({ naceCodes: ['99.99'] }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: null,
    });
    expect(none.defaults.has(B1_ELEMENT.ACTIVITY_CODES)).toBe(false);
  });

  it('discloses the boundary as its member, and the subsidiaries only under a consolidated one', () => {
    const individual = entityDefaults({
      registered: FULL,
      snapshot: snapshot({
        consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL,
        // An inert list under `individual` is master data, not a disclosure (the entity model's rule).
        consolidationMembers: [{ name: 'Filiala Nord', countryCode: 'MD' }],
      }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: null,
    });
    expect(textOf(individual.defaults, B1_ELEMENT.BASIS_FOR_REPORTING)).toEqual(['vsme:IndividualMember']);
    expect(individual.defaults.has(B1_ELEMENT.SUBSIDIARY_NAME)).toBe(false);

    const consolidated = entityDefaults({
      registered: FULL,
      snapshot: snapshot({
        consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
        consolidationMembers: [
          { name: 'Filiala Nord', countryCode: 'MD' },
          { name: 'Filiala Sud', countryCode: null },
        ],
      }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: null,
    });
    expect(textOf(consolidated.defaults, B1_ELEMENT.BASIS_FOR_REPORTING)).toEqual(['vsme:ConsolidatedMember']);
    expect(textOf(consolidated.defaults, B1_ELEMENT.SUBSIDIARY_NAME)).toEqual(['Filiala Nord', 'Filiala Sud']);
  });

  it('lays the sites out as a repeating group: one row per site, null where a site lacks the field', () => {
    const result = entityDefaults({
      registered: FULL,
      snapshot: snapshot({
        sites: [
          {
            name: 'Hala',
            addressLine1: 'str. Uzinelor 5',
            locality: 'Chișinău',
            postalCode: 'MD-2023',
            countryCode: 'md',
            latitude: '47.010500',
            longitude: '28.863800',
          },
          { name: 'Depozit', addressLine1: null, locality: 'Bălți', postalCode: null, countryCode: null, latitude: '47.76', longitude: null },
        ],
      }),
      scope: REPORT_SCOPE.BASIC,
      legalFormMember: null,
    });
    expect(textOf(result.defaults, B1_ELEMENT.SITE_ADDRESS)).toEqual(['str. Uzinelor 5', null]);
    expect(textOf(result.defaults, B1_ELEMENT.SITE_CITY)).toEqual(['Chișinău', 'Bălți']);
    expect(textOf(result.defaults, B1_ELEMENT.SITE_POSTAL_CODE)).toEqual(['MD-2023', null]);
    // Upper-cased and qualified as the country domain's options are (task 91.1).
    expect(textOf(result.defaults, B1_ELEMENT.SITE_COUNTRY)).toEqual(['country:MD', null]);
    // Coordinates as one string, and nothing where either half is unset.
    expect(textOf(result.defaults, B1_ELEMENT.SITE_GPS)).toEqual(['47.010500, 28.863800', null]);

    const noSites = entityDefaults({ registered: FULL, snapshot: snapshot(), scope: REPORT_SCOPE.BASIC, legalFormMember: null });
    expect(noSites.defaults.has(B1_ELEMENT.SITE_ADDRESS)).toBe(false);
  });
});

describe('the pinned names, against the shipped artefacts', () => {
  // That the artefacts read with nothing logged is `taxonomy-artefact.spec.ts`'s claim; this one
  // only asks whether the names pinned above are in them.
  const store = seedConfigurationStore(readSeedEntries());
  const registry = new TaxonomyRegistryService(store);
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

  it('registers at least two versions, so the pins are held against more than one', () => {
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it.each(versions)('%s names every element and member this mapping pins, in B1', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    expect(taxonomy).not.toBeNull();
    if (taxonomy === null) return;

    for (const key of Object.values(B1_ELEMENT)) {
      const element = taxonomy.elements.find((candidate) => candidate.key === key);
      expect({ key, module: element?.module }).toEqual({ key, module: 'B1' });
    }

    const memberKeys = (domain: string): readonly string[] =>
      taxonomy.enumerations.find((candidate) => candidate.key === domain)?.members.map((m) => m.key) ?? [];
    for (const member of Object.values(SCOPE_MEMBER)) {
      expect(memberKeys(B1_DOMAIN.BASIS_FOR_PREPARATION)).toContain(member);
    }
    for (const member of Object.values(BASIS_MEMBER)) {
      expect(memberKeys(B1_DOMAIN.BASIS_FOR_REPORTING)).toContain(member);
    }
    // The site elements share one typed axis, which is what makes them a repeating group.
    const siteAxes = new Set(
      [B1_ELEMENT.SITE_ADDRESS, B1_ELEMENT.SITE_CITY, B1_ELEMENT.SITE_COUNTRY].map(
        (key) => taxonomy.elements.find((candidate) => candidate.key === key)?.axes.join(),
      ),
    );
    expect(siteAxes.size).toBe(1);
    const [axisKey] = siteAxes;
    expect(registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key: axisKey ?? '' })?.typed).toBe(true);
  });

  it('classifies every Moldovan legal form into a member the shipped domains declare', () => {
    const entry = readSeedEntries().find((candidate) => candidate.kind === 'organization_legal_form' && candidate.scope === 'md');
    const payload = entry?.payload as { forms: string[]; vsmeMembers: Record<string, string> };
    // Every registered form is classified — a form added without its member would pre-fill
    // nothing silently for every entity holding it.
    expect(Object.keys(payload.vsmeMembers).sort()).toEqual([...payload.forms].sort());
    for (const version of versions) {
      const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      const members = taxonomy?.enumerations.find((c) => c.key === B1_DOMAIN.LEGAL_FORM)?.members.map((m) => m.key) ?? [];
      for (const member of Object.values(payload.vsmeMembers)) expect(members).toContain(member);
    }
    expect(ENUMERATION_TAXONOMY.VSME).toBe(B1_DOMAIN.LEGAL_FORM.split(':')[0]);
  });
});
