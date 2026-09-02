import { Logger } from '@nestjs/common';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_KIND, PERIOD_TYPE } from '@api/contracts/taxonomy-registry.port';
import { TaxonomyRegistryService } from './services/taxonomy-registry.service';
import {
  externalDomainConfigKind,
  REPORTING_TAXONOMY_CONFIG_KIND,
  TAXONOMY_STANDARD,
  VSME_TAXONOMY_CONFIG_KIND,
} from './constants/taxonomy.constants';

/**
 * The shipped artefacts, read by the shipped registry (task 33.1).
 *
 * **The unit spec proves the reader handles a payload; this proves it handles *ours*.** They are
 * different claims and only the second can fail on a re-extraction: `tools/extract-vsme-taxonomy.mjs`
 * runs again at every VSME release (NFR-12's quarterly watch) and at task 33.3's second version, and
 * its output is 63 KB nobody reviews line by line. What makes that safe is this file — the artefact
 * and the reader asserted to agree, hermetically, with no database.
 *
 * **The strongest assertion here is that nothing is logged at `error`.** Every way the registry can
 * partially fail — an unreadable element, an axis pointing at a domain that is not registered — is a
 * log line and a quietly smaller answer, by design, because a taxonomy is operator data and must not
 * take the process down. That design is only safe if something reads the log, and this is it.
 */
describe('the shipped VSME taxonomy artefacts', () => {
  const VERSION = '2026-05-01';

  // The seed reader and the store fake moved to `testing/` at task 33.2, when a second spec needed
  // them — `apps/api/CLAUDE.md`: "testing/ holds test doubles shared by more than one spec".
  const entries = readSeedEntries();
  const store = seedConfigurationStore(entries);

  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errors.mockRestore();
  });

  const registry = () => new TaxonomyRegistryService(store);
  const at = { standard: TAXONOMY_STANDARD.VSME, version: VERSION };

  it('reads every registered version with nothing dropped and nothing logged', () => {
    const taxonomy = registry();
    for (const version of taxonomy.registeredVersions({ standard: TAXONOMY_STANDARD.VSME })) {
      const read = taxonomy.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
      expect(read).not.toBeNull();

      // Nothing dropped: the reader's count equals the artefact's own.
      const payload = entries.find(
        (entry) => entry.kind === VSME_TAXONOMY_CONFIG_KIND && entry.scope === version,
      )?.payload as { elements: Record<string, unknown> };
      expect(read?.elements).toHaveLength(Object.keys(payload.elements).length);
    }
    expect(errors).not.toHaveBeenCalled();
  });

  it('carries the Basic and Comprehensive modules the standard defines', () => {
    // B1 … B11 is the Basic Module; C1 … C9 the Comprehensive Module, additive over it
    // (problem_overview.md OQ-12, FR-177). Both ship in one published taxonomy version.
    expect(registry().taxonomy(at)?.modules).toEqual([
      'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11',
      'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
    ]);
  });

  it('gives every element a kind and a period type the port declares', () => {
    const kinds: readonly string[] = Object.values(DISCLOSURE_KIND);
    const periods: readonly string[] = Object.values(PERIOD_TYPE);

    for (const element of registry().taxonomy(at)?.elements ?? []) {
      expect(kinds).toContain(element.kind);
      expect(periods).toContain(element.periodType);
    }
  });

  it('never names an axis on an element that the version does not declare', () => {
    const taxonomy = registry();
    for (const element of taxonomy.taxonomy(at)?.elements ?? []) {
      for (const axis of element.axes) {
        expect(taxonomy.axis({ ...at, key: axis })).not.toBeNull();
      }
    }
  });

  /**
   * The B3 case, pinned as a worked example because it is the one §7.3 stated wrongly for months:
   * `EnergyConsumptionFromRenewableSources` does not exist — renewable is a dimension *member*.
   */
  it('reports renewable energy as a dimension member, not as an element', () => {
    const taxonomy = registry();
    expect(taxonomy.element({ ...at, key: 'EnergyConsumptionFromRenewableSources' })).toBeNull();

    const fuels = taxonomy.element({ ...at, key: 'EnergyConsumptionFromFuels' });
    expect(fuels).toMatchObject({ module: 'B3', kind: DISCLOSURE_KIND.NUMERIC });
    expect(fuels?.axes).toEqual(['BreakdownOfEnergyConsumptionAxis']);

    const axis = taxonomy.axis({ ...at, key: 'BreakdownOfEnergyConsumptionAxis' });
    expect(axis?.members.map((member) => member.key)).toEqual([
      'RenewableEnergyMember',
      'NonRenewableEnergyMember',
    ]);
    // A fact carrying no dimension is the total, not a missing breakdown.
    expect(axis?.defaultMember).toBe('TotalRenewableAndNonRenewableEnergyMember');
  });

  /** The B8 case, wrong in the opposite direction: gender is four elements, not one axis. */
  it('reports gender as four elements, not as a dimension', () => {
    const taxonomy = registry();
    expect(taxonomy.element({ ...at, key: 'NumberOfEmployeesByGender' })).toBeNull();

    for (const key of [
      'NumberOfFemaleEmployees',
      'NumberOfMaleEmployees',
      'NumberOfOtherGenderEmployees',
      'NumberOfNonReportedGenderEmployees',
    ]) {
      expect(taxonomy.element({ ...at, key })).toMatchObject({ module: 'B8' });
    }
  });

  describe('the EU List of Waste, published as its own taxonomy', () => {
    const axis = () => registry().axis({ ...at, key: 'TypeOfWasteAxis' });

    it('resolves through the axis, so no caller learns of the second artefact', () => {
      // 20 chapters + 111 sub-chapters + 842 six-digit entries — the List of Waste's own structure.
      expect(axis()?.members).toHaveLength(973);
      expect(errors).not.toHaveBeenCalled();
    });

    it('states the hazard classification only where the list states it', () => {
      const members = axis()?.members ?? [];
      const sixDigit = members.filter((member) => member.code?.replaceAll(' ', '').length === 6);

      // A chapter is not "non-hazardous"; the classification does not apply at that level.
      expect(members.filter((m) => m.hazardous === null)).toHaveLength(
        members.length - sixDigit.length,
      );
      expect(sixDigit.every((member) => typeof member.hazardous === 'boolean')).toBe(true);
      expect(sixDigit.filter((member) => member.hazardous)).toHaveLength(408);
    });

    it('carries the classification’s own names, free of XBRL scaffolding', () => {
      // Not `20 03 01 - Non-Hazardous - Mixed municipal waste [member]`: the code and the hazard
      // flag are their own fields, and `[member]` is an internal notion no reader may see.
      expect(axis()?.members.find((member) => member.code === '20 03 01')?.labels.en).toBe(
        'Mixed municipal waste',
      );
    });

    /**
     * EFRAG publishes English only for this taxonomy. Stated as a test so the gap is a fact the
     * suite carries rather than a comment — task 33.2 authors `ro` and `ru`, which have no EFRAG
     * standing (T-14, NFR-24) and are never machine-translated.
     */
    it('has English only, which is what EFRAG publishes', () => {
      const languages = new Set((axis()?.members ?? []).flatMap((m) => Object.keys(m.labels)));
      expect([...languages]).toEqual(['en']);
    });
  });

  describe('the choice fields, and the answers each offers (task 91.1)', () => {
    it('resolves every enumeration element’s domain to members, or names it as external', () => {
      const versions = registry().registeredVersions({ standard: TAXONOMY_STANDARD.VSME });
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        const at = { standard: TAXONOMY_STANDARD.VSME, version };
        const taxonomy = registry().taxonomy(at);
        const choiceFields = (taxonomy?.elements ?? []).filter(
          (e) => e.kind === DISCLOSURE_KIND.ENUMERATION || e.kind === DISCLOSURE_KIND.ENUMERATION_SET,
        );
        // The set, not a floor: a floor of ten passed with three choice fields demoted to text
        // (gate-integrity review, 2 Sep 2026). Both registered versions carry these thirteen.
        expect(choiceFields.map((e) => e.key).sort()).toEqual(
          [
            'BasisForPreparation',
            'BasisForReporting',
            'CountryOfPrimaryOperationsAndLocationOfSignificantAssets',
            'CountryOfSite',
            'EmployeeCountingMethodology',
            'ListOfDisclosuresForWhichNoChangesAreReportedComparedToThePreviousPeriodReporting',
            'ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation',
            'NaceSectorClassificationCodes',
            'TypeOfNumberOfEmployees',
            'UndertakingsLegalForm',
            'SustainabilityIssueAddressedByPracticePolicyAndOrFutureInitiative',
            'TypeOfContentCoveredByTheCodeOfConductOrHumanRightsPolicyForItsOwnWorkforce',
            'TypeOfHumanRightRelatedToTheConfirmedIncident',
          ].sort(),
        );
        for (const field of choiceFields) {
          const key = field.domain?.includes(':') ? field.domain : `vsme:${field.domain ?? ''}`;
          const enumeration = registry().enumeration({ ...at, key });
          // Every choice field's domain is registered, and offers members unless the package only
          // references it — which is ISO 3166 and nothing else.
          expect(enumeration).not.toBeNull();
          if (enumeration?.external === null) expect(enumeration.members.length).toBeGreaterThan(0);
          else expect(enumeration?.external).toBe('iso3166');
        }
      }
      expect(errors).not.toHaveBeenCalled();
    });

    it('draws B1’s basis for reporting from two members, neither of them scaffolding', () => {
      const members = registry().enumeration({ ...at, key: 'vsme:BasisForReportingMember' })?.members ?? [];
      expect(members.map((m) => m.key).sort()).toEqual(['ConsolidatedMember', 'IndividualMember']);
    });

    it('draws the list of disclosures from 51 members, the unprefixed ones included', () => {
      // EFRAG declares 24 of these with ids like `B1ListOfSubsidiariesMember` — no `vsme_` — and a
      // read keyed on the prefix offered 27 of 51.
      const members = registry().enumeration({ ...at, key: 'vsme:ListOfDisclosuresMember' })?.members ?? [];
      expect(members).toHaveLength(51);
      expect(members.some((m) => m.key === 'B1ListOfSubsidiariesMember')).toBe(true);
    });

    it('resolves NACE through the enumeration, as its own classification with pointed codes', () => {
      const nace = registry().enumeration({ ...at, key: 'nace:NACE_AllEconomicActivitiesNAMember' });
      expect(nace?.external).toBeNull();
      // Sections A–V, divisions, groups and classes: NACE Rev. 2.1's own structure.
      expect(nace?.members).toHaveLength(1047);
      const cereals = nace?.members.find((m) => m.key === 'NACE_A0111');
      // The pointed code is what CAEM prints and what `nace-code.md.json` is keyed by.
      expect(cereals?.code).toBe('01.11');
      expect(cereals?.labels.en).toBe('Growing of cereals, other than rice, leguminous crops and oil seeds');
      expect(nace?.members.find((m) => m.key === 'NACE_A')?.code).toBe('A');
      expect(errors).not.toHaveBeenCalled();
    });
  });

  it('pins new reports to a version that is actually registered', () => {
    const taxonomy = registry();
    const pin = taxonomy.pinFor({});
    expect(pin).not.toBeNull();
    expect(
      taxonomy.taxonomy({ standard: pin?.standard ?? '', version: pin?.taxonomyVersion ?? '' }),
    ).not.toBeNull();
  });

  it('derives the same configuration kinds the seed filenames use', () => {
    // The seed's name and the registry's derivation are one statement, not two kept in step.
    expect(entries.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        VSME_TAXONOMY_CONFIG_KIND,
        REPORTING_TAXONOMY_CONFIG_KIND,
        externalDomainConfigKind('waste'),
      ]),
    );
  });
});
