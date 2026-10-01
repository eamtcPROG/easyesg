import type { DataSource } from 'typeorm';
import { ConfigurationHistory } from '../src/infrastructure/configuration/configuration-history.service';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { EMISSION_FACTOR_SET_CONFIG_KIND } from '../src/modules/core/calculator/constants/calculator.constants';
import { FactorSetCatalog } from '../src/modules/core/calculator/services/factor-set-catalog.service';
import { connectAs } from './support/database';

/**
 * Emission factor sets as configuration (task 37; FR-34, FR-35, FR-71, NFR-19, NFR-85).
 *
 * Each case is one of the task's claims, against real rows: **registered as data** (37.1) — a set is a publication and
 * nothing else, resolved by the period it serves; **an overlapping window refused by the database** (37.1) — the
 * schedule's primary key, not the catalog; **a change with no redeploy** (37.2) — a correction reaches a replica on its
 * poll, while the version a run pinned stays readable; **a revert in one step** (37.2) — and in one window, which is
 * what task 37.2 changed in the publisher.
 *
 * **On a country no seed registers** (`zz`, ISO 3166's user-assigned range), so the suite never touches the shipped
 * `md` set — these suites run against a store the developer also uses (task 172) — and its cleanup can delete what it
 * published outright, as the owner, around the immutability trigger.
 */
const COUNTRY = 'zz';

const set = (label: string, factor: string) => ({
  label,
  sources: [
    {
      key: 'natural_gas',
      ghgScope: 'scope_1',
      emissionFactor: factor,
      units: { m3: '0.00928', MWh: '1' },
      reference: 'A fixture, not a factor',
    },
  ],
});

describe('emission factor sets (task 37)', () => {
  let app: DataSource;
  let owner: DataSource;
  let publisher: ConfigurationPublisher;

  /** A replica as a running process holds one: its own cache, found out about changes by polling. */
  const replica = async (): Promise<{ store: ConfigurationStore; catalog: FactorSetCatalog }> => {
    const store = new ConfigurationStore(app);
    await store.refreshIfStale();
    return { store, catalog: new FactorSetCatalog(store, new ConfigurationHistory(app)) };
  };

  const window2026 = { validFrom: '2026-01-01', validTo: '2027-01-01' };
  const window2027 = { validFrom: '2027-01-01', validTo: '2028-01-01' };

  const publish = (payload: Record<string, unknown>, window: { validFrom: string; validTo: string }) =>
    publisher.publish({ kind: EMISSION_FACTOR_SET_CONFIG_KIND, scope: COUNTRY, payload, ...window });

  beforeAll(async () => {
    app = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-factor-sets-app');
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-factor-sets-owner');
    publisher = new ConfigurationPublisher(app);
  });

  afterAll(async () => {
    if (app?.isInitialized) await app.destroy();
    if (owner?.isInitialized) await owner.destroy();
  });

  beforeEach(async () => {
    await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
    await owner.query(`DELETE FROM config.entry_schedule WHERE kind = $1 AND scope = $2`, [
      EMISSION_FACTOR_SET_CONFIG_KIND,
      COUNTRY,
    ]);
    await owner.query(`DELETE FROM config.entry_version WHERE kind = $1 AND scope = $2`, [
      EMISSION_FACTOR_SET_CONFIG_KIND,
      COUNTRY,
    ]);
    await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
  });

  it('registers a set as data, resolved by the period it serves', async () => {
    await publish(set('2026.1', '0.202'), window2026);

    const { catalog } = await replica();
    const resolved = catalog.inForce({ country: COUNTRY, periodStart: '2026-01-01' });
    expect(resolved?.label).toBe('2026.1');
    expect(resolved?.sources.get('natural_gas')?.emissionFactor).toBe('0.202');
    // Half-open on both sides: the day before the window and the day it closes are served by nothing.
    expect(catalog.inForce({ country: COUNTRY, periodStart: '2025-12-31' })).toBeNull();
    expect(catalog.inForce({ country: COUNTRY, periodStart: '2027-01-01' })).toBeNull();
  });

  it('refuses, in the database, a second set over a period one already serves', async () => {
    await publish(set('2026.1', '0.202'), window2026);

    await expect(publish(set('mid-2026', '0.3'), { validFrom: '2026-07-01', validTo: '2027-07-01' })).rejects.toThrow(
      /exclusion constraint|conflicting key/i,
    );
    // And an adjacent window is how next year's set succeeds this one.
    await expect(publish(set('2027.1', '0.19'), window2027)).resolves.toMatchObject({ revision: 2 });
  });

  it('lands a correction with no redeploy, and keeps the pinned version readable', async () => {
    const first = await publish(set('2026.1', '0.202'), window2026);
    const { store, catalog } = await replica();
    const pin = catalog.inForce({ country: COUNTRY, periodStart: '2026-03-01' })?.pin;
    expect(pin).toEqual({ country: COUNTRY, revision: first.revision });

    await publish(set('2026.2', '0.21'), window2026);

    // The replica is not told; it finds out the way a running one does.
    expect(await store.refreshIfStale()).toBe(true);
    expect(catalog.inForce({ country: COUNTRY, periodStart: '2026-03-01' })?.label).toBe('2026.2');
    // A fresh replica has never seen revision 1 in force; the history is what still holds it (NFR-19).
    const fresh = await replica();
    const pinned = await fresh.catalog.pinned({ country: COUNTRY, revision: first.revision });
    expect(pinned?.label).toBe('2026.1');
    expect(pinned?.sources.get('natural_gas')?.emissionFactor).toBe('0.202');
  });

  it('reverts a correction in one step, and moves no other window', async () => {
    const first = await publish(set('2026.1', '0.202'), window2026);
    await publish(set('2027.1', '0.19'), window2027);
    await publish(set('2026.2', '0.21'), window2026);

    await publisher.revert({ kind: EMISSION_FACTOR_SET_CONFIG_KIND, scope: COUNTRY, toRevision: first.revision });

    const { catalog } = await replica();
    expect(catalog.inForce({ country: COUNTRY, periodStart: '2026-03-01' })?.label).toBe('2026.1');
    // Revision 2 is later than revision 1 too, and before task 37.2 the revert moved its window back with the other.
    expect(catalog.inForce({ country: COUNTRY, periodStart: '2027-03-01' })?.label).toBe('2027.1');
  });
});
