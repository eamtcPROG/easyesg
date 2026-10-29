import { Logger } from '@nestjs/common';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { DISCLOSURE_DERIVATION_CONFIG_KIND } from '../constants/disclosure.constants';
import { INPUT_ANSWER, OPERAND_SOURCE, inputAnswerOf } from '../models/derivation.model';
import { DerivationService } from './derivation.service';

/**
 * **The shipped derivations, against the shipped taxonomy versions** (added by task 79, when C5, C8 and C9 brought
 * theirs). The artefact is hand-written and names element keys EFRAG owns, and a mistyped one fails silently: the
 * service reads it, the calculator writes a figure under a key no step presents, and the field it was meant for stays
 * an ordinary unanswered one. `AxisShapeService`'s and `OfferedMembersService`'s specs hold their artefacts the same way.
 */
describe('the shipped derivations (tasks 36.10, 38.4, 79)', () => {
  const entries = readSeedEntries();
  const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });

  let logged: string[] = [];
  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  const shipped = () => {
    const entry = entries.find(
      (candidate) => candidate.kind === DISCLOSURE_DERIVATION_CONFIG_KIND && candidate.scope === TAXONOMY_STANDARD.VSME,
    );
    expect(entry).toBeDefined();
    return new DerivationService({
      get: (query: { kind: string; scope: string }) =>
        query.kind === DISCLOSURE_DERIVATION_CONFIG_KIND && query.scope === TAXONOMY_STANDARD.VSME
          ? { ...entry, revision: 1 }
          : undefined,
    } as unknown as ConfigurationStore).all({ standard: TAXONOMY_STANDARD.VSME });
  };

  it('reads every entry whole, dropping none', () => {
    // Exact: a derivation added or lost is a figure that stops or starts being typed, which is a decision.
    expect([...shipped().keys()].sort()).toEqual([
      'EmployeeTurnoverRate',
      'FemaleToMaleRatioAtManagementLevelForTheReportingPeriod',
      'GenderDiversityRatioInGovernanceBody',
      'PercentageGapInPayBetweenFemaleAndMaleEmployees',
      'PercentageOfEmployeesCoveredByCollectiveBargainingAgreements',
      'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
      'Scope1AndScope2GreenhouseGasEmissionsIntensityValueLocationBased',
      'TotalGrossLocationBasedScope1AndScope2GHGEmissions',
      'TotalRevenuesDerivedFromFossilFuelCoalOilAndGasSector',
      'UndertakingsAreExcludedFromAnyEuReferenceBenchmarksThatAreAlignedWithTheParisAgreement',
    ]);
    expect(logged).toEqual([]);
  });

  it.each(versions)('%s declares every derived element and every disclosure operand, in a module', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    expect(taxonomy).not.toBeNull();
    const declared = new Map(taxonomy?.elements.map((element) => [element.key, element]) ?? []);
    for (const derivation of shipped().values()) {
      const keys = [
        derivation.element,
        ...Object.values(derivation.operands)
          .filter((operand) => operand.from === OPERAND_SOURCE.DISCLOSURE)
          .map((operand) => operand.key),
      ];
      for (const key of keys) {
        expect({ version, key, presented: (declared.get(key)?.modules.length ?? 0) > 0 }).toEqual({
          version,
          key,
          presented: true,
        });
      }
    }
  });

  it.each(versions)('%s derives a yes or a no only into a yes/no element, and a figure only into one that is not', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    for (const derivation of shipped().values()) {
      const kind = taxonomy?.elements.find((element) => element.key === derivation.element)?.kind;
      const yesOrNo = inputAnswerOf(derivation.formula) === INPUT_ANSWER.YES_NO;
      expect({ version, element: derivation.element, yesOrNo, boolean: kind === DISCLOSURE_KIND.BOOLEAN }).toEqual({
        version,
        element: derivation.element,
        yesOrNo,
        boolean: yesOrNo,
      });
    }
  });
});
