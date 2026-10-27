import type { RegisteredTaxonomy, TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { B1_DOMAIN } from '../domain/entity-defaults';
import { ReportNotEditableError, ReportNotFoundError, TaxonomyVersionUnavailableError } from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { B1_ELEMENT } from '../models/b1-element.model';
import {
  DISCLOSURE_STATE,
  NO_DIMENSION,
  type DisclosureValue,
  type DisclosureValueKey,
  type DisclosureValueWrite,
} from '../models/disclosure-value.model';
import { REPORT_SCOPE, REPORT_STATUS } from '../models/report.model';
import { aReport, FakeReportStore } from '../testing/report.fakes';
import { aStoredValue, anEnumeration } from '../testing/step-read.fakes';
import { ChangeReportScope } from './change-report-scope.use-case';

/**
 * UC-192 — the scope raised or lowered on a report in progress (tasks 31.3, 78.3).
 *
 * **B1's basis for preparation is what this spec is mostly about**, because it is the one answer a scope change
 * touches: rewritten where B1 holds it, left unwritten where B1 was never opened (task 180.2 reads any stored record
 * key as *opened*), and never written to itself. That every other answer stands needs no case here — this use case is
 * handed no store that could move one.
 */

const AT = new Date('2026-10-27T10:00:00.000Z');
const REPORT_ID = '00000000-0000-0000-0000-0000000000f1';
const SUPERSEDED = '2025-11-30';
const OPTION_A = 'vsme:OptionABasicModuleOnlyMember';
const OPTION_B = 'vsme:OptionBBasicModuleAndComprehensiveModuleMember';

const BASIS_KEY: DisclosureValueKey = {
  reportId: REPORT_ID,
  elementKey: B1_ELEMENT.BASIS_FOR_PREPARATION,
  dimensionKey: NO_DIMENSION,
  ordinal: 0,
};

/** The two stored-value calls this use case makes, over a map — and every write recorded, for the trail's sake. */
class FakeValues implements Pick<DisclosureValueStore, 'find' | 'write'> {
  readonly writes: DisclosureValueWrite[] = [];
  constructor(private readonly stored: Map<string, DisclosureValue> = new Map()) {}

  find(key: DisclosureValueKey): Promise<DisclosureValue | null> {
    return Promise.resolve(this.stored.get(key.elementKey) ?? null);
  }

  write(value: DisclosureValueWrite): Promise<DisclosureValue> {
    this.writes.push(value);
    const row = aStoredValue({ ...value.key, ...value.contents });
    this.stored.set(value.key.elementKey, row);
    return Promise.resolve(row);
  }
}

const REGISTERED: RegisteredTaxonomy = {
  standard: TAXONOMY_STANDARD.VSME,
  version: '2026-05-01',
  modules: ['B1'],
  elements: [],
  enumerations: [
    anEnumeration({
      key: B1_DOMAIN.BASIS_FOR_PREPARATION,
      taxonomy: 'vsme',
      members: [
        { key: 'OptionABasicModuleOnlyMember', code: null, hazardous: null, parent: null, labels: {} },
        { key: 'OptionBBasicModuleAndComprehensiveModuleMember', code: null, hazardous: null, parent: null, labels: {} },
      ],
    }),
  ],
};

const registry = (registered: RegisteredTaxonomy | null = REGISTERED): Pick<TaxonomyRegistry, 'taxonomy'> => ({
  taxonomy: () => registered,
});

const storedBasis = (valueText: string): Map<string, DisclosureValue> =>
  new Map([[B1_ELEMENT.BASIS_FOR_PREPARATION, aStoredValue({ ...BASIS_KEY, valueText, state: DISCLOSURE_STATE.OK })]]);

const build = (
  options: {
    readonly report?: ReturnType<typeof aReport>;
    readonly values?: FakeValues;
    readonly registered?: RegisteredTaxonomy | null;
  } = {},
) => {
  const values = options.values ?? new FakeValues();
  const reports = new FakeReportStore([], options.report === undefined ? [aReport({ id: REPORT_ID })] : [options.report]);
  const useCase = new ChangeReportScope(reports, values, registry(options.registered), () => AT);
  return { values, useCase };
};

describe('ChangeReportScope', () => {
  it('adds Comprehensive to a report already in progress', async () => {
    const { useCase } = build();

    const updated = await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } });

    expect(updated.scope).toBe(REPORT_SCOPE.BASIC_AND_COMPREHENSIVE);
    expect(updated.updatedAt).toEqual(AT);
  });

  /**
   * **The pin does not move on an edit, and cannot be named on one.** There is no field for it on `ReportPatch`, so this
   * asserts the consequence rather than the mechanism — the mechanism is a type, and below it a privilege.
   */
  it('leaves the pinned versions exactly where they were', async () => {
    const { useCase } = build({
      report: aReport({ id: REPORT_ID, templateVersion: SUPERSEDED, taxonomyVersion: SUPERSEDED }),
    });

    const updated = await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } });

    expect(updated.templateVersion).toBe(SUPERSEDED);
    expect(updated.taxonomyVersion).toBe(SUPERSEDED);
  });

  it('rewrites B1’s stored basis to the scope’s option, raising and lowering alike (task 78.3)', async () => {
    const { useCase, values } = build({ values: new FakeValues(storedBasis(OPTION_A)) });

    await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } });
    expect(values.writes.map((write) => [write.key, write.contents.valueText, write.contents.state])).toEqual([
      [BASIS_KEY, OPTION_B, DISCLOSURE_STATE.OK],
    ]);

    await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC } });
    expect(values.writes.map((write) => write.contents.valueText)).toEqual([OPTION_B, OPTION_A]);
  });

  /** Task 180.2 reads any of B1's record keys stored as *B1 opened*, which ends the snapshot following the entity. */
  it('writes no basis where B1 was never opened — its default is already the scope’s', async () => {
    const { useCase, values } = build();

    await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } });

    expect(values.writes).toEqual([]);
  });

  it('writes nothing where the stored basis already states the scope — no change to itself in the trail', async () => {
    const { useCase, values } = build({ values: new FakeValues(storedBasis(OPTION_A)) });

    await useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC } });

    expect(values.writes).toEqual([]);
  });

  it('refuses where the report’s pinned version is no longer registered, rather than leaving the basis behind', async () => {
    const { useCase } = build({ values: new FakeValues(storedBasis(OPTION_A)), registered: null });

    await expect(
      useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } }),
    ).rejects.toBeInstanceOf(TaxonomyVersionUnavailableError);
  });

  it('refuses an edit to a report whose period is locked', async () => {
    const { useCase, values } = build({
      report: aReport({ id: REPORT_ID, status: REPORT_STATUS.LOCKED }),
      values: new FakeValues(storedBasis(OPTION_A)),
    });

    await expect(
      useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE } }),
    ).rejects.toBeInstanceOf(ReportNotEditableError);
    expect(values.writes).toEqual([]);
  });

  it('refuses a report that does not exist, or belongs to another tenant', async () => {
    const { useCase } = build({ report: aReport({ id: '00000000-0000-0000-0000-0000000000f2' }) });

    await expect(
      useCase.execute({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC } }),
    ).rejects.toBeInstanceOf(ReportNotFoundError);
  });
});
