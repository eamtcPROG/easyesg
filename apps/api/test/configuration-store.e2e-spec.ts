import { DataSource } from 'typeorm';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';

/**
 * The configuration store (DR-3, AD-4, FR-61, FR-62, NFR-85).
 *
 * DR-3's requirement is not "a table of settings" — it is that a value changes **without a
 * redeploy**, publishes within a working day of approval, and reverts in one step. Each of those is
 * a different property and each is tested here:
 *
 *  - **without a redeploy** is about propagation, so the store version and the replica cache are
 *    what the tests assert on, not the table;
 *  - **published versions are immutable** (AD-4) is what makes revert safe, and is enforced by
 *    trigger rather than by the publish service, because a service can be bypassed;
 *  - **one date, one version in force** is the primary key, and §12.3 calls it the strongest single
 *    argument for PostgreSQL 18 here: two factor sets in force for one date is silent, and visible
 *    only in a figure that was already reported (NFR-19, NFR-87).
 */

const KIND = 'threshold';
const SCOPE = 'probe';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

describe('configuration store (DR-3, AD-4)', () => {
  let app: DataSource;
  let owner: DataSource;
  let publisher: ConfigurationPublisher;

  beforeAll(async () => {
    app = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: required('DB_USER'),
      password: required('DB_PASSWORD'),
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-config-app',
    });
    await app.initialize();

    owner = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: required('DB_MIGRATOR_USER'),
      password: required('DB_MIGRATOR_PASSWORD'),
      synchronize: false,
      entities: [],
      applicationName: 'easyesg-config-owner',
    });
    await owner.initialize();

    publisher = new ConfigurationPublisher(app);
  }, 30_000);

  afterAll(async () => {
    if (app?.isInitialized) await app.destroy();
    if (owner?.isInitialized) await owner.destroy();
  });

  beforeEach(async () => {
    // The owner, because the immutability trigger refuses a DELETE of anything published — which is
    // the guarantee under test, so the cleanup has to go around it rather than through it.
    await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
    await owner.query(`DELETE FROM config.entry_schedule WHERE kind = $1`, [KIND]);
    await owner.query(`DELETE FROM config.entry_version WHERE kind = $1`, [KIND]);
    await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
  });

  describe('a change takes effect with no redeploy', () => {
    it('moves the store version, and a replica notices on its next poll', async () => {
      const replica = new ConfigurationStore(app);
      await replica.refreshIfStale();
      const before = replica.cachedVersion;
      expect(replica.get(KIND, SCOPE)).toBeUndefined();

      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });

      // The replica is deliberately not told. It finds out the same way a real one does.
      expect(await replica.refreshIfStale()).toBe(true);
      expect(replica.cachedVersion).toBeGreaterThan(before);
      expect(replica.get(KIND, SCOPE)?.payload).toEqual({ turnover: 50 });
    });

    it('does not rebuild the cache when nothing changed', async () => {
      const replica = new ConfigurationStore(app);
      await replica.refreshIfStale();
      // The poll is a question about whether a reload is needed, not a reload. Answering "no"
      // cheaply is what makes a five-second interval affordable on every replica.
      expect(await replica.refreshIfStale()).toBe(false);
    });
  });

  describe('revert is one step (NFR-85)', () => {
    it('puts the previous version back without republishing it', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 75 } });

      const replica = new ConfigurationStore(app);
      await replica.refreshIfStale();
      expect(replica.get(KIND, SCOPE)).toMatchObject({ revision: 2, payload: { turnover: 75 } });

      await publisher.revert(KIND, SCOPE, 1);

      await replica.refreshIfStale();
      // Revision 1, not a revision 3 carrying the old payload. NFR-19 needs the version a stored
      // calculation used to still be the version it used.
      expect(replica.get(KIND, SCOPE)).toMatchObject({ revision: 1, payload: { turnover: 50 } });
    });

    it('supersedes the previous version rather than deleting it', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 75 } });

      const rows = await owner.query<{ revision: number; state: string }[]>(
        `SELECT revision, state::text FROM config.entry_version WHERE kind = $1 ORDER BY revision`,
        [KIND],
      );
      expect(rows).toEqual([
        { revision: 1, state: 'superseded' },
        { revision: 2, state: 'published' },
      ]);
    });
  });

  describe('published versions are immutable (AD-4)', () => {
    it('refuses an edit to a published payload', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await expect(
        app.query(`UPDATE config.entry_version SET payload = '{"turnover":1}'::jsonb WHERE kind = $1`, [
          KIND,
        ]),
      ).rejects.toThrow(/published and immutable/i);
    });

    // Two layers, in the order they deny — the same shape as the append-only substrate. The
    // application never reaches the trigger, and the owner has no privilege layer to stop it, so
    // testing only one role would leave half the guarantee unexercised.
    it('refuses a delete from the application, by privilege', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await expect(app.query(`DELETE FROM config.entry_version WHERE kind = $1`, [KIND])).rejects.toThrow(
        /permission denied/i,
      );
    });

    it('refuses a delete from the owning role, by trigger', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await expect(
        owner.query(`DELETE FROM config.entry_version WHERE kind = $1`, [KIND]),
      ).rejects.toThrow(/cannot be deleted/i);
    });

    // An edited "published" version is indistinguishable afterwards from one that was always that
    // way, which is exactly what NFR-87 forbids: a rule or factor change must never silently
    // restate a previously reported figure.
    it('allows only the transition that retires it', async () => {
      await publisher.publish({ kind: KIND, scope: SCOPE, payload: { turnover: 50 } });
      await expect(
        app.query(`UPDATE config.entry_version SET state = 'draft' WHERE kind = $1`, [KIND]),
      ).rejects.toThrow(/published and immutable/i);
    });
  });

  describe('one date, one version in force (§7.9, §12.3)', () => {
    it('refuses a second version overlapping a date already covered', async () => {
      await publisher.publish({
        kind: KIND,
        scope: SCOPE,
        payload: { turnover: 50 },
        validFrom: '2026-01-01',
        validTo: '2027-01-01',
      });

      await expect(
        publisher.publish({
          kind: KIND,
          scope: SCOPE,
          payload: { turnover: 75 },
          validFrom: '2026-06-01',
          validTo: '2026-09-01',
        }),
      ).rejects.toThrow(/exclusion constraint|conflicting key/i);
    });

    it('accepts an adjacent range, so a factor set can succeed another', async () => {
      await publisher.publish({
        kind: KIND,
        scope: SCOPE,
        payload: { turnover: 50 },
        validFrom: '2026-01-01',
        validTo: '2027-01-01',
      });
      await publisher.publish({
        kind: KIND,
        scope: SCOPE,
        payload: { turnover: 75 },
        validFrom: '2027-01-01',
        validTo: '2028-01-01',
      });

      const replica = new ConfigurationStore(app);
      await replica.refreshIfStale();
      // The date decides, and it is a calendar date: which threshold applies on 1 January is a
      // local-calendar fact (NFR-34), not something an instant can settle.
      expect(replica.get(KIND, SCOPE, '2026-06-01')?.payload).toEqual({ turnover: 50 });
      expect(replica.get(KIND, SCOPE, '2027-06-01')?.payload).toEqual({ turnover: 75 });
      expect(replica.get(KIND, SCOPE, '2025-06-01')).toBeUndefined();
    });
  });

  describe('seeding from config/seed', () => {
    it('publishes nothing on a second run, so a redeploy is not a configuration change', async () => {
      const first = await seedConfiguration(app);
      expect(first.every((o) => o.revision !== null)).toBe(true);

      const second = await seedConfiguration(app);
      // Republishing on every deploy would move the store version for no change — invalidating
      // every replica's cache — and bury the real publication history under identical revisions.
      expect(second.every((o) => o.published === false)).toBe(true);
    });

    it('registers the three locales AD-4 puts in the store rather than in the release', async () => {
      await seedConfiguration(app);
      const replica = new ConfigurationStore(app);
      await replica.refreshIfStale();

      const registration = replica.get<{ locales: { code: string }[] }>(
        'locale_registration',
        'global',
      );
      expect(registration?.payload.locales.map((l) => l.code)).toEqual(['ro', 'en', 'ru']);
    });
  });
});
