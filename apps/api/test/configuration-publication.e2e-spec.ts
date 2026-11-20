import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ConfigurationDraftMissingError } from '../src/infrastructure/configuration/configuration-draft-missing.error';
import { ConfigurationDrafts } from '../src/infrastructure/configuration/configuration-drafts.service';
import { ConfigurationPayloadRefusedError } from '../src/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '../src/infrastructure/configuration/configuration-revision-mismatch.error';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { required } from './support/database';

/**
 * Reviewed sets, drafts and sign-off in the configuration store (tasks 67.14, 67.15; FR-61, FR-62; 182/36, 182/37;
 * §12.5.6's task-67.14/67.15 row), against the real tables and their trigger.
 *
 * What only this suite can prove: that a set is in force whole or not at all **as the database sees it** — a refusal on
 * the last slot leaves the first unpublished, which a fake that does not model rollback would pass either way; that
 * every version of a set names one publication carrying the sign-off; that a draft is invisible to the schedule and is
 * promoted in place; and that the trigger lets a draft be deleted while still refusing anything that has been in force.
 *
 * **`help_topic` is the refusing kind**: its rule requires a Romanian block, so a payload without one is refused the
 * way any unreadable payload is. Its scopes here are this run's own, cleared around the trigger like the store suite's.
 */
const RUN = `${process.pid}-${Date.now()}`;
const KIND = 'publication_test';
const REFUSING_KIND = 'help_topic';
const OPERATOR = '01920000-0000-7000-8000-0000000000aa';
const topic = (title: string) => ({ order: 1, locales: { ro: { title, summary: `${title}.` } } });

describe('reviewed sets, drafts and sign-off in the store (tasks 67.14, 67.15)', () => {
  let app: DataSource;
  let owner: DataSource;
  let publisher: ConfigurationPublisher;
  let drafts: ConfigurationDrafts;

  const connect = (user: string, password: string, name: string) =>
    new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'esg',
      username: required(user),
      password: required(password),
      synchronize: false,
      entities: [],
      applicationName: name,
    });

  const inForce = async (kind: string, scope: string) =>
    (
      await owner.query<{ revision: number; payload: unknown; publication_id: string | null }[]>(
        `SELECT v.revision, v.payload, v.publication_id
           FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
          WHERE s.kind = $1 AND s.scope = $2`,
        [kind, scope],
      )
    )[0] ?? null;

  const clear = async () => {
    await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
    for (const kind of [KIND, REFUSING_KIND]) {
      const scopes = kind === KIND ? '%' : `e2e-${RUN}-%`;
      await owner.query(`DELETE FROM config.entry_schedule WHERE kind = $1 AND scope LIKE $2`, [kind, scopes]);
      await owner.query(`DELETE FROM config.entry_version WHERE kind = $1 AND scope LIKE $2`, [kind, scopes]);
    }
    await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
  };

  beforeAll(async () => {
    app = connect('DB_USER', 'DB_PASSWORD', 'easyesg-publication-app');
    owner = connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-publication-owner');
    await app.initialize();
    await owner.initialize();
    publisher = new ConfigurationPublisher(app);
    drafts = new ConfigurationDrafts(app);
  }, 30_000);

  beforeEach(clear);

  afterAll(async () => {
    if (owner?.isInitialized) await clear();
    if (app?.isInitialized) await app.destroy();
    if (owner?.isInitialized) await owner.destroy();
  });

  describe('a reviewed set, in one transaction (task 67.14; 182/36)', () => {
    it('puts every slot in force, each version naming one publication that holds the sign-off', async () => {
      const signOff = { ro: { by: OPERATOR, at: '2026-11-18T10:00:00.000Z' } };
      const set = await publisher.publishSet({
        entries: [
          { kind: KIND, scope: 'a', payload: { value: 1 } },
          { kind: KIND, scope: 'b', payload: { value: 2 } },
        ],
        actorId: OPERATOR,
        signOff,
      });

      expect(set.versions.map(({ scope, revision }) => ({ scope, revision }))).toEqual([
        { scope: 'a', revision: 1 },
        { scope: 'b', revision: 1 },
      ]);
      expect((await inForce(KIND, 'a'))?.publication_id).toBe(set.publicationId);
      expect((await inForce(KIND, 'b'))?.publication_id).toBe(set.publicationId);
      const [publication] = await owner.query<{ published_by: string; sign_off: unknown }[]>(
        `SELECT published_by, sign_off FROM config.publication WHERE id = $1`,
        [set.publicationId],
      );
      expect(publication).toEqual({ published_by: OPERATOR, sign_off: signOff });
    });

    it('publishes nothing when one slot’s payload is refused, the refusal before any lock', async () => {
      await expect(
        publisher.publishSet({
          entries: [
            { kind: REFUSING_KIND, scope: `e2e-${RUN}-ok`, payload: topic('Bun') },
            { kind: REFUSING_KIND, scope: `e2e-${RUN}-bad`, payload: { order: 1, locales: { en: { title: 'No' } } } },
          ],
        }),
      ).rejects.toBeInstanceOf(ConfigurationPayloadRefusedError);
      expect(await inForce(REFUSING_KIND, `e2e-${RUN}-ok`)).toBeNull();
    });

    it('rolls back a slot already written when a later one refuses inside the transaction', async () => {
      await publisher.publish({ kind: KIND, scope: 'b', payload: { value: 'first' } });
      const publications = async () =>
        Number((await owner.query<{ n: string }[]>(`SELECT count(*) AS n FROM config.publication`))[0].n);
      const before = await publications();

      await expect(
        publisher.publishSet({
          entries: [
            { kind: KIND, scope: 'a', payload: { value: 'set' } },
            { kind: KIND, scope: 'b', payload: { value: 'set' }, expectedRevision: 0 },
          ],
        }),
      ).rejects.toBeInstanceOf(ConfigurationRevisionMismatchError);

      expect(await inForce(KIND, 'a')).toBeNull();
      expect((await inForce(KIND, 'b'))?.payload).toEqual({ value: 'first' });
      // The publication row went with the rollback too.
      expect(await publications()).toBe(before);
    });

    it('reverts one slot alone, leaving the rest of its set in force (NFR-85)', async () => {
      await publisher.publishSet({ entries: [{ kind: KIND, scope: 'a', payload: { v: 1 } }, { kind: KIND, scope: 'b', payload: { v: 1 } }] });
      await publisher.publishSet({ entries: [{ kind: KIND, scope: 'a', payload: { v: 2 } }, { kind: KIND, scope: 'b', payload: { v: 2 } }] });

      await publisher.revert({ kind: KIND, scope: 'a', toRevision: 1 });

      expect((await inForce(KIND, 'a'))?.payload).toEqual({ v: 1 });
      expect((await inForce(KIND, 'b'))?.payload).toEqual({ v: 2 });
    });
  });

  describe('drafts and review (task 67.15; 182/37)', () => {
    it('keeps a draft out of the schedule, so no reader can address it', async () => {
      await publisher.publish({ kind: KIND, scope: 'a', payload: { v: 'live' } });
      const draft = await drafts.save({ kind: KIND, scope: 'a', payload: { v: 'draft' }, actorId: OPERATOR });

      expect(draft).toMatchObject({ state: 'draft', revision: 2, draftedBy: OPERATOR, payload: { v: 'draft' } });
      expect((await inForce(KIND, 'a'))?.payload).toEqual({ v: 'live' });
    });

    it('edits the one open draft of a slot rather than opening a second, and a save takes it back from review', async () => {
      await drafts.save({ kind: KIND, scope: 'a', payload: { v: 1 } });
      await drafts.submit({ kind: KIND, scope: 'a' });
      const edited = await drafts.save({ kind: KIND, scope: 'a', payload: { v: 2 } });

      expect(edited).toMatchObject({ state: 'draft', revision: 1, payload: { v: 2 } });
      expect(await drafts.openOf({ kind: KIND })).toHaveLength(1);
    });

    it('publishes a draft in review in place, with the slot’s next revision and the publication named', async () => {
      const drafted = await drafts.save({ kind: KIND, scope: 'a', payload: { v: 'reviewed' } });
      // A version published directly while the draft waited takes the next number first.
      await publisher.publish({ kind: KIND, scope: 'a', payload: { v: 'direct' } });
      await drafts.submit({ kind: KIND, scope: 'a' });

      const set = await publisher.publishSet({ entries: [{ kind: KIND, scope: 'a', fromReview: true }], actorId: OPERATOR });

      expect(set.versions).toEqual([{ id: drafted.id, revision: 3, kind: KIND, scope: 'a' }]);
      expect(await inForce(KIND, 'a')).toEqual({ revision: 3, payload: { v: 'reviewed' }, publication_id: set.publicationId });
      expect(await drafts.openOf({ kind: KIND })).toEqual([]);
    });

    it('refuses to publish a draft not yet in review, and to submit a slot with no draft', async () => {
      await drafts.save({ kind: KIND, scope: 'a', payload: { v: 1 } });
      await expect(
        publisher.publishSet({ entries: [{ kind: KIND, scope: 'a', fromReview: true }] }),
      ).rejects.toBeInstanceOf(ConfigurationDraftMissingError);
      await expect(drafts.submit({ kind: KIND, scope: 'b' })).rejects.toBeInstanceOf(ConfigurationDraftMissingError);
    });

    it('lets a draft be discarded, and still refuses a delete of anything that has been in force', async () => {
      await publisher.publish({ kind: KIND, scope: 'a', payload: { v: 'live' } });
      await drafts.save({ kind: KIND, scope: 'a', payload: { v: 'draft' } });

      expect(await drafts.discard({ kind: KIND, scope: 'a' })).toBe(true);
      expect(await drafts.discard({ kind: KIND, scope: 'a' })).toBe(false);
      await expect(app.query(`DELETE FROM config.entry_version WHERE kind = $1`, [KIND])).rejects.toThrow(
        /published and cannot be deleted|cannot be deleted/u,
      );
    });
  });

  describe('a window opened at a date on an effective-dated slot (task 67.21; 182/52)', () => {
    const windows = async () =>
      owner.query<{ validity: string; payload: unknown }[]>(
        `SELECT s.validity::text AS validity, v.payload
           FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
          WHERE s.kind = $1 AND s.scope = 'dated' ORDER BY lower(s.validity) NULLS FIRST`,
        [KIND],
      );

    it('closes the open window the day before and opens the new payload from it, in one transaction', async () => {
      const first = await publisher.publish({ kind: KIND, scope: 'dated', payload: { v: 'old' }, validFrom: '2026-01-01' });
      await publisher.openWindow({
        kind: KIND,
        scope: 'dated',
        at: '2027-01-01',
        payload: { v: 'adopted' },
        actorId: OPERATOR,
        expectedRevision: first.revision,
      });
      expect(await windows()).toEqual([
        { validity: '[2026-01-01,2027-01-01)', payload: { v: 'old' } },
        { validity: '[2027-01-01,)', payload: { v: 'adopted' } },
      ]);
    });

    it('refuses a date not after the open window’s start, and a revision moved since it was read', async () => {
      const first = await publisher.publish({ kind: KIND, scope: 'dated', payload: { v: 'old' }, validFrom: '2026-01-01' });
      await expect(
        publisher.openWindow({ kind: KIND, scope: 'dated', at: '2026-01-01', payload: {}, expectedRevision: first.revision }),
      ).rejects.toBeInstanceOf(ConfigurationPayloadRefusedError);
      await expect(
        publisher.openWindow({ kind: KIND, scope: 'dated', at: '2027-01-01', payload: {}, expectedRevision: first.revision + 1 }),
      ).rejects.toBeInstanceOf(ConfigurationRevisionMismatchError);
      expect(await windows()).toEqual([{ validity: '[2026-01-01,)', payload: { v: 'old' } }]);
    });

    it('leaves a schedule an operator reshaped to the operator, where the seed would otherwise refuse the deploy', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'easyesg-seed-'));
      try {
        writeFileSync(
          join(directory, `publication-test.dated.json`),
          JSON.stringify({ schedule: [{ validFrom: '2026-01-01', payload: { v: 'old' } }] }),
        );
        await seedConfiguration(app, { directory });
        const [{ revision }] = await owner.query<{ revision: number }[]>(
          `SELECT v.revision FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
            WHERE s.kind = $1 AND s.scope = 'dated'`,
          [KIND],
        );
        await publisher.openWindow({ kind: KIND, scope: 'dated', at: '2027-01-01', payload: { v: 'adopted' }, actorId: OPERATOR, expectedRevision: revision });

        const again = await seedConfiguration(app, { directory });
        expect(again).toEqual([expect.objectContaining({ kind: KIND, scope: 'dated', keptOperatorEdit: true })]);
        expect((await windows()).map((window) => window.validity)).toEqual(['[2026-01-01,2027-01-01)', '[2027-01-01,)']);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });
});

