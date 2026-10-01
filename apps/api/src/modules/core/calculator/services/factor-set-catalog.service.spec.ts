import { Logger } from '@nestjs/common';
import type { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { readSeedEntries, seedConfigurationStore, type SeedEntry } from '@api/testing/seed-configuration-store';
import { FactorSetCatalog } from './factor-set-catalog.service';

/**
 * `FactorSetCatalog` against a store holding two windows and a history holding a superseded revision (task 37.2).
 *
 * The database half — the windows refused when they overlap, a correction reaching a replica on its poll, the revert
 * that moves one window and not its neighbour — is `test/factor-sets.e2e-spec.ts`'s; this is the reading.
 */
describe('FactorSetCatalog', () => {
  const KIND = 'emission_factor_set';

  const set = (label: string, factor: string) => ({
    label,
    sources: [
      {
        key: 'natural_gas',
        ghgScope: 'scope_1',
        emissionFactor: factor,
        units: { m3: '0.00928' },
        reference: 'IPCC 2006, Vol. 2',
      },
    ],
  });

  const windows: SeedEntry[] = [
    { kind: KIND, scope: 'md', revision: 3, payload: set('2026.2', '0.21'), validFrom: '2026-01-01', validTo: '2027-01-01' },
    { kind: KIND, scope: 'md', revision: 2, payload: set('2027.1', '0.19'), validFrom: '2027-01-01', validTo: null },
  ];

  /** The superseded first revision of the 2026 window, which only the history still holds. */
  const superseded = { kind: KIND, scope: 'md', revision: 1, payload: set('2026.1', '0.20'), validFrom: '2026-01-01', validTo: '2027-01-01' };

  const history = (versions: readonly (typeof superseded)[]) => {
    const version = jest.fn((query: { kind: string; scope: string; revision: number }) =>
      Promise.resolve(
        versions.find((v) => v.kind === query.kind && v.scope === query.scope && v.revision === query.revision),
      ),
    );
    return { version, fake: { version } as Pick<ConfigurationHistory, 'version'> as ConfigurationHistory };
  };

  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('inForce — the set that serves a period', () => {
    const catalog = new FactorSetCatalog(seedConfigurationStore(windows), history([]).fake);

    it('answers by the period’s start, at both half-open bounds', () => {
      expect(catalog.inForce({ country: 'md', periodStart: '2026-01-01' })?.label).toBe('2026.2');
      expect(catalog.inForce({ country: 'md', periodStart: '2026-12-31' })?.label).toBe('2026.2');
      expect(catalog.inForce({ country: 'md', periodStart: '2027-01-01' })?.label).toBe('2027.1');
    });

    it('pins the revision in force, which is what a run records', () => {
      expect(catalog.inForce({ country: 'md', periodStart: '2026-07-01' })?.pin).toEqual({ country: 'md', revision: 3 });
    });

    it('answers nothing for a period no window serves, or a country with no set', () => {
      expect(catalog.inForce({ country: 'md', periodStart: '2025-12-31' })).toBeNull();
      expect(catalog.inForce({ country: 'ro', periodStart: '2026-01-01' })).toBeNull();
    });
  });

  describe('pinned — the set a run used, after it has moved on', () => {
    it('reads a superseded revision from the history, factors and all', async () => {
      const catalog = new FactorSetCatalog(seedConfigurationStore(windows), history([superseded]).fake);

      const pinned = await catalog.pinned({ country: 'md', revision: 1 });
      expect(pinned?.label).toBe('2026.1');
      expect(pinned?.sources.get('natural_gas')?.emissionFactor).toBe('0.20');
      // And the period it served now resolves to the correction — the two answers a recalculation offer compares.
      expect(catalog.inForce({ country: 'md', periodStart: '2026-07-01' })?.label).toBe('2026.2');
    });

    it('reads a revision once, since a published one cannot change', async () => {
      const reads = history([superseded]);
      const catalog = new FactorSetCatalog(seedConfigurationStore(windows), reads.fake);

      await catalog.pinned({ country: 'md', revision: 1 });
      await catalog.pinned({ country: 'md', revision: 1 });
      expect(reads.version).toHaveBeenCalledTimes(1);
    });

    it('serves a pin to the set in force from what inForce already read', async () => {
      const reads = history([]);
      const catalog = new FactorSetCatalog(seedConfigurationStore(windows), reads.fake);

      catalog.inForce({ country: 'md', periodStart: '2026-07-01' });
      expect((await catalog.pinned({ country: 'md', revision: 3 }))?.label).toBe('2026.2');
      expect(reads.version).not.toHaveBeenCalled();
    });

    it('answers nothing, and says so, for a pin naming no published version', async () => {
      const catalog = new FactorSetCatalog(seedConfigurationStore(windows), history([]).fake);

      await expect(catalog.pinned({ country: 'md', revision: 9 })).resolves.toBeNull();
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('revision 9'));
    });
  });

  /**
   * `config/seed/emission-factor-set.md.json` — the starting set the project owner reviewed source by source (task 37.1,
   * §12.5.6's task-37 row). Hand-written, so this is what holds it readable: a source the reader drops is a source no
   * reporter can calculate, and nothing else would say so before a reporter met it.
   */
  describe('the shipped set', () => {
    const catalog = new FactorSetCatalog(seedConfigurationStore(readSeedEntries()), history([]).fake);

    it('reads whole, every source kept, for a FY2026 period', () => {
      const shipped = catalog.inForce({ country: 'md', periodStart: '2026-01-01' });

      expect(shipped?.label).toBe('2026.1');
      expect([...(shipped?.sources.keys() ?? [])]).toEqual([
        'natural_gas',
        'diesel',
        'heating_oil',
        'residual_fuel_oil',
        'lpg',
        'coal',
        'wood',
        'diesel_road',
        'petrol_road',
        'lpg_road',
        'electricity_grid',
      ]);
      expect(logged).not.toHaveBeenCalled();
    });

    it('serves every period starting before 2027, and none after', () => {
      expect(catalog.inForce({ country: 'md', periodStart: '2024-01-01' })?.label).toBe('2026.1');
      expect(catalog.inForce({ country: 'md', periodStart: '2026-12-31' })?.label).toBe('2026.1');
      // The 2027 set is an adjacent window someone publishes; until then a FY2027 period is refused, not served 2026's.
      expect(catalog.inForce({ country: 'md', periodStart: '2027-01-01' })).toBeNull();
    });

    it('puts only grid electricity in Scope 2', () => {
      const shipped = catalog.inForce({ country: 'md', periodStart: '2026-01-01' });
      const scope2 = [...(shipped?.sources.values() ?? [])].filter((source) => source.ghgScope === 'scope_2_location_based');
      expect(scope2.map((source) => source.key)).toEqual(['electricity_grid']);
    });
  });

  it('fails closed on an unreadable set, naming the revision to replace', () => {
    const broken: SeedEntry[] = [{ kind: KIND, scope: 'md', revision: 4, payload: { sources: [] }, validFrom: null, validTo: null }];
    const catalog = new FactorSetCatalog(seedConfigurationStore(broken), history([]).fake);

    expect(catalog.inForce({ country: 'md', periodStart: '2026-01-01' })).toBeNull();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('(revision 4) is unreadable'));
  });
});
