import { ENUMERATION_TAXONOMY, type RegisteredTaxonomy, type TaxonomyAxis } from '@api/contracts/taxonomy-registry.port';
import { CONSOLIDATION_BASIS } from '@api/modules/core/entity/models/reporting-entity.model';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { isChoiceKind } from '@easyesg/vsme';
import { REPORT_SCOPE } from '../models/report.model';
import { aMember, anAxis, anElement, anEnumeration } from '../testing/step-read.fakes';
import { admittedMembers, holdsOnlyAdmitted } from './admitted-members';
import { entityDefaults } from './entity-defaults';
import { qualifiedDomainOf } from './qualified-domain';

/**
 * Task 258: what each choice domain admits, and the write's question over it — then held against the shipped taxonomy
 * versions, the half that can fail on a re-extraction: a domain that stopped resolving would refuse every answer to its
 * field, and a step pre-fill outside its domain would be refused the moment the reporter accepts it.
 */
const LEGAL_FORMS = anEnumeration({
  key: 'vsme:ListOfUndertakingsLegalFormsMember',
  taxonomy: ENUMERATION_TAXONOMY.VSME,
  members: [aMember({ key: 'CooperativeMember' }), aMember({ key: 'PartnershipMember' })],
});
const COUNTRIES = anEnumeration({ key: 'country:CountryDomain', taxonomy: ENUMERATION_TAXONOMY.COUNTRY, external: 'iso3166' });
const COUNTRY_AXIS = anAxis({
  key: 'CountryOfEmploymentContractAxis',
  defaultMember: 'AllCountriesMember',
  members: [aMember({ key: 'MD' }), aMember({ key: 'RO' })],
  memberTaxonomy: ENUMERATION_TAXONOMY.COUNTRY,
});
const ENERGY_AXIS = anAxis({ key: 'BreakdownOfEnergyConsumptionAxis', members: [aMember({ key: 'RenewableEnergyMember' })] });
const AXES = new Map<string, TaxonomyAxis>([COUNTRY_AXIS, ENERGY_AXIS].map((axis) => [axis.key, axis]));

const admitted = (over: Partial<Pick<RegisteredTaxonomy, 'elements' | 'enumerations'>> = {}) =>
  admittedMembers({
    registered: {
      elements: [
        anElement({ key: 'NumberOfEmployeesForCountryOfEmploymentContract', axes: [COUNTRY_AXIS.key] }),
        anElement({ key: 'EmployeesByContractAlsoOnTheCountryAxis', axes: [COUNTRY_AXIS.key] }),
        anElement({ key: 'EnergyConsumptionFromElectricity', axes: [ENERGY_AXIS.key] }),
      ],
      enumerations: [LEGAL_FORMS, COUNTRIES],
      ...over,
    },
    axisOf: (key) => AXES.get(key) ?? null,
  });

const sorted = (members: ReadonlySet<string> | undefined) => [...(members ?? [])].sort();

describe('admittedMembers (task 258)', () => {
  it('admits a shipped domain’s own members, qualified as a stored answer names them', () => {
    expect(sorted(admitted().get(LEGAL_FORMS.key))).toEqual(['vsme:CooperativeMember', 'vsme:PartnershipMember']);
  });

  it('admits for a referenced domain the members the version’s axes carry from its taxonomy, once each', () => {
    expect(sorted(admitted().get(COUNTRIES.key))).toEqual(['country:MD', 'country:RO']);
  });

  it('admits nothing for a referenced domain no axis of the version carries', () => {
    expect(sorted(admitted({ elements: [] }).get(COUNTRIES.key))).toEqual([]);
  });
});

describe('holdsOnlyAdmitted (task 258)', () => {
  const members = new Set(['country:MD', 'country:RO']);

  it('holds a member of the domain, and a set of them however it is spaced', () => {
    expect(holdsOnlyAdmitted({ valueText: 'country:MD', admitted: members })).toBe(true);
    expect(holdsOnlyAdmitted({ valueText: ' country:MD \n country:RO ', admitted: members })).toBe(true);
  });

  it('refuses a set with one member outside the domain', () => {
    expect(holdsOnlyAdmitted({ valueText: 'country:MD country:ADRefused', admitted: members })).toBe(false);
  });

  it('judges no answer that names no member', () => {
    for (const valueText of [null, undefined, '']) {
      expect(holdsOnlyAdmitted({ valueText, admitted: new Set() })).toBe(true);
    }
  });
});

describe('the shipped taxonomy versions (task 258)', () => {
  const registry = new TaxonomyRegistryService(seedConfigurationStore(readSeedEntries()));
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

  const readVersion = (version: string) => {
    const registered = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    if (registered === null) throw new Error(`${version} is registered and does not read`);
    const domains = admittedMembers({
      registered,
      axisOf: (key) => registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key }),
    });
    return { registered, domains };
  };

  it('registers two versions, so each case below runs against both', () => {
    expect(versions).toHaveLength(2);
  });

  it.each(versions)('%s: every choice field’s domain admits members', (version) => {
    const { registered, domains } = readVersion(version);
    const choices = registered.elements.filter((element) => isChoiceKind(element.kind));
    expect(choices).toHaveLength(13);
    for (const element of choices) {
      const size = domains.get(qualifiedDomainOf(element) ?? '')?.size ?? 0;
      expect({ element: element.key, admits: size > 0 }).toEqual({ element: element.key, admits: true });
    }
  });

  it.each(versions)('%s: the country domain admits the 256 codes the package carries, and nothing else', (version) => {
    const countries = readVersion(version).domains.get('country:CountryDomain');
    expect(countries?.size).toBe(256);
    expect(countries?.has('country:MD')).toBe(true);
    expect(countries?.has('country:RO')).toBe(true);
    expect(countries?.has('country:ADRefused')).toBe(false);
    expect(countries?.has('country:ZZ')).toBe(false);
  });

  it.each(versions)('%s: every choice the step pre-fills from an entity is admitted, a site abroad included', (version) => {
    const { registered, domains } = readVersion(version);
    const { defaults } = entityDefaults({
      registered,
      scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
      legalFormMember: 'PrivateLimitedLiabilityUndertakingMember',
      snapshot: {
        takenAt: new Date('2026-01-01T00:00:00.000Z'),
        legalForm: 'srl',
        naceCodes: ['10.71', '47.11'],
        consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
        consolidationMembers: [{ name: 'Filiala', countryCode: 'ro' }],
        sites: ['md', 'ro'].map((countryCode) => ({
          name: countryCode,
          addressLine1: null,
          locality: null,
          postalCode: null,
          countryCode,
          latitude: null,
          longitude: null,
        })),
      },
    });
    const choices = registered.elements.filter((element) => isChoiceKind(element.kind) && defaults.has(element.key));
    // The scope's basis, the reporting basis, the legal form, the activity codes and the site countries.
    expect(choices.map((element) => element.key).sort()).toEqual([
      'BasisForPreparation',
      'BasisForReporting',
      'CountryOfSite',
      'NaceSectorClassificationCodes',
      'UndertakingsLegalForm',
    ]);
    for (const element of choices) {
      const members = domains.get(qualifiedDomainOf(element) ?? '') ?? new Set<string>();
      for (const row of defaults.get(element.key) ?? []) {
        const valueText = row?.valueText ?? null;
        expect({ element: element.key, valueText, admitted: holdsOnlyAdmitted({ valueText, admitted: members }) }).toEqual({
          element: element.key,
          valueText,
          admitted: true,
        });
      }
    }
  });
});
