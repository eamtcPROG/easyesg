import { isDeepStrictEqual } from 'node:util';
import { addDecimals } from '@api/contracts/types/decimal';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { keptHistory, readKeptVersions, type KeptVersion } from '@api/testing/kept-versions';
import { readSeedEntries } from '@api/testing/seed-configuration-store';
import { EMISSION_FACTOR_SET_CONFIG_KIND } from './constants/calculator.constants';
import { resultFigures } from './domain/run-results';
import type { CalcRunStore } from './interfaces/calc-run-store.interface';
import type { CalcInput, CalcResult, StoredCalcRun } from './models/calc-run.model';
import { GHG_SCOPE } from './models/factor-set.model';
import { FactorSetCatalog } from './services/factor-set-catalog.service';
import { ReadCalcRun } from './use-cases/read-calc-run.use-case';

/**
 * **NFR-87's suite, the factor-set half** (task 201; `architecture.md` §12.5.6's task-201 row; FR-35, FR-71): every
 * factor set the seed has shipped is kept in `config/version-pinned/`, with runs pinned to it and the results each
 * stored, and every one is replayed here against its own kept set and must reproduce those results exactly.
 *
 * **Why figures recorded by an earlier build, and not by this run**: a run's results and its pin are immutable rows, so
 * a factor change cannot move a stored figure — what can is code. A change to the reader or the arithmetic changes what
 * an earlier set computes, and a suite that recorded and checked its figures under one build would agree with itself.
 *
 * **The replay is the product's own**: `ReadCalcRun` — `GET …/calculator/runs/{id}`, NFR-19's — over `FactorSetCatalog`
 * reading the pin from configuration history, which `keptHistory` serves from the kept files. So *reproduces* here is
 * the verdict the platform itself would give.
 */
interface KeptLine {
  readonly sourceKey: string;
  readonly siteOrdinal?: number;
  readonly quantity: string | null;
  readonly unitCode: string | null;
  readonly notAvailableReason?: string;
  readonly override?: { readonly tonnesCo2e: string; readonly explanation: string };
}

interface KeptRun {
  readonly name: string;
  readonly lines: readonly KeptLine[];
  /** What the run stored — `core.calc_result`'s rows, in `resultFigures`' order. */
  readonly results: readonly CalcResult[];
}

interface FactorSetPayload {
  readonly label: string;
  readonly sources: readonly {
    readonly key: string;
    readonly ghgScope: string;
    readonly emissionFactor: string;
    readonly units: Readonly<Record<string, string>>;
  }[];
}

interface KeptFactorSet {
  readonly payload: FactorSetPayload & Record<string, unknown>;
  readonly runs: readonly KeptRun[];
}

type KeptSet = KeptVersion<KeptFactorSet>;

const KEPT: readonly KeptSet[] = readKeptVersions<KeptFactorSet>({ kind: EMISSION_FACTOR_SET_CONFIG_KIND });

/** A kept line as a run retains it — the provenance a replay never reads is filled with a fixed value. */
const asInput = (line: KeptLine, index: number): CalcInput => ({
  sourceId: `line-${index + 1}`,
  siteOrdinal: line.siteOrdinal ?? 0,
  sourceKey: line.sourceKey,
  description: null,
  contents: { quantity: line.quantity, unitCode: line.unitCode, notAvailableReason: line.notAvailableReason ?? null },
  override: line.override ?? null,
  overriddenBy: null,
});

/** One kept run, replayed against its pin as the platform replays a stored run. */
function replay(input: { readonly version: KeptSet; readonly run: KeptRun }) {
  const stored: StoredCalcRun = {
    id: 'kept-run',
    reportId: 'kept-report',
    factorSet: { country: input.version.scope, revision: input.version.revision },
    recordedAt: new Date(0),
    recordedBy: null,
    inputs: input.run.lines.map(asInput),
    results: input.run.results,
  };
  const runs: Pick<CalcRunStore, 'find'> = { find: () => Promise.resolve(stored) };
  // The store is never read: a replay asks for its pin, and only `inForce` would read what is in force.
  const factorSets = new FactorSetCatalog({} as ConfigurationStore, keptHistory([input.version]));
  return new ReadCalcRun(runs as CalcRunStore, factorSets).execute({ reportId: stored.reportId, runId: stored.id });
}

/**
 * Every figure-bearing datum of a set, moved one at a time: each source's factor and scope, and each of its units'
 * conversions. A citation moves no figure and is left alone.
 */
function doctorings(payload: FactorSetPayload): { readonly moved: string; readonly payload: FactorSetPayload }[] {
  const withSource = (index: number, change: Partial<FactorSetPayload['sources'][number]>): FactorSetPayload => ({
    ...payload,
    sources: payload.sources.map((source, at) => (at === index ? { ...source, ...change } : source)),
  });
  return payload.sources.flatMap((source, index) => [
    { moved: `${source.key}'s factor`, payload: withSource(index, { emissionFactor: addDecimals(source.emissionFactor, '1') }) },
    {
      moved: `${source.key}'s scope`,
      payload: withSource(index, {
        ghgScope: source.ghgScope === GHG_SCOPE.SCOPE_1 ? GHG_SCOPE.SCOPE_2_LOCATION_BASED : GHG_SCOPE.SCOPE_1,
      }),
    },
    ...Object.entries(source.units).map(([unit, megawattHours]) => ({
      moved: `${source.key}'s ${unit}`,
      payload: withSource(index, { units: { ...source.units, [unit]: addDecimals(megawattHours, '1') } }),
    })),
  ]);
}

it('keeps at least one factor set', () => {
  // `describe.each` over nothing reports no tests rather than a failure, so an emptied or moved directory says so here.
  expect(KEPT.length).toBeGreaterThan(0);
});

it('keeps every factor set the seed ships — a changed set is added to config/version-pinned/, the earlier kept', () => {
  const shipped = readSeedEntries().filter((entry) => entry.kind === EMISSION_FACTOR_SET_CONFIG_KIND);
  expect(shipped.length).toBeGreaterThan(0);
  for (const entry of shipped) {
    const kept = KEPT.some((version) => version.scope === entry.scope && isDeepStrictEqual(version.file.payload, entry.payload));
    expect({ scope: entry.scope, label: entry.payload.label, kept }).toEqual({
      scope: entry.scope,
      label: entry.payload.label,
      kept: true,
    });
  }
});

describe.each(KEPT.map((version) => [`${version.scope} ${version.name}`, version] as const))(
  'the kept factor set %s',
  (_, version) => {
    it('is read whole through the adapter a pin is read through', async () => {
      const set = await new FactorSetCatalog({} as ConfigurationStore, keptHistory([version])).pinned({
        country: version.scope,
        revision: version.revision,
      });
      expect(set?.sources.size).toBe(version.file.payload.sources.length);
    });

    it.each(version.file.runs.map((run) => [run.name, run] as const))(
      'replays %s to exactly the results it stored',
      async (__, run) => {
        const replayed = await replay({ version, run });
        expect(
          resultFigures(replayed.scopes).map((figure) => ({
            elementKey: figure.elementKey,
            tonnesCo2e: figure.valueNumeric,
          })),
        ).toEqual(run.results);
        expect(replayed.reproduces).toBe(true);
      },
    );

    /**
     * The gate's own proof (task-201 row (2)): a set whose datum moved is a set that would restate a figure, and some
     * recorded run must stop reproducing under it. A datum no run exercises is one whose restatement this suite could
     * not see — so this fails on a gap in the runs, as well as on a comparison that stopped biting.
     */
    it('stops reproducing a recorded run when any source’s factor, scope or unit conversion moves', async () => {
      for (const doctored of doctorings(version.file.payload)) {
        const moved = { ...version, file: { ...version.file, payload: { ...version.file.payload, ...doctored.payload } } };
        const replays = await Promise.all(version.file.runs.map((run) => replay({ version: moved, run })));
        expect({ moved: doctored.moved, restated: replays.some((replayed) => !replayed.reproduces) }).toEqual({
          moved: doctored.moved,
          restated: true,
        });
      }
    });
  },
);
