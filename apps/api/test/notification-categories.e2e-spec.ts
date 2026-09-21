import { DataSource } from 'typeorm';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration, type SeedOutcome } from '../src/infrastructure/configuration/seed-configuration';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '../src/modules/platform/notification/constants/notification-category.constants';
import { NotificationCategoryCatalog } from '../src/modules/platform/notification/services/notification-category-catalog.service';

/**
 * **A category's behaviour changes with no redeploy** — task 49.1's expected result, against the real
 * store, the real seed loader and the reader together (FR-173, UC-176, NFR-85).
 *
 * `configuration-store.e2e-spec.ts` proves the mechanism over a probe kind; this proves it over the
 * artefact this task ships, which is the claim that could fail on its own: a category scoped by a dotted key
 * the loader cannot name, a reader that caches, or a catalogue that reads a different scope than the one
 * published would each leave that suite green. **The suite seeds what it reads** — a gate must not depend on
 * state a previous command left behind — and it puts the seeded revision back, so no other suite meets the
 * change.
 */
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

describe('notification categories as configuration (task 49.1)', () => {
  let app: DataSource;
  let publisher: ConfigurationPublisher;
  let seeded: SeedOutcome[];

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
      applicationName: 'easyesg-notification-categories',
    });
    await app.initialize();
    publisher = new ConfigurationPublisher(app);
    seeded = await seedConfiguration(app);
  }, 30_000);

  afterAll(async () => {
    if (app?.isInitialized) await app.destroy();
  });

  const replicaCatalog = async () => {
    const store = new ConfigurationStore(app);
    await store.refreshIfStale();
    return { store, catalog: new NotificationCategoryCatalog(store) };
  };

  it('reads every shipped category from the seeded store, one artefact per category key', async () => {
    // **What the loader named, not only what the store holds.** The rows outlive the run that wrote them, so
    // a store read alone would stay green on a loader that no longer names these files — measured, when the
    // file-name pattern was put back to refusing a dotted scope and this suite still passed.
    expect(
      seeded
        .filter((outcome) => outcome.kind === NOTIFICATION_CATEGORY_CONFIG_KIND)
        .map((outcome) => outcome.scope)
        .sort(),
    ).toEqual([...Object.values(NOTIFICATION_CATEGORY)].sort());

    const { catalog } = await replicaCatalog();

    for (const categoryKey of Object.values(NOTIFICATION_CATEGORY)) {
      expect(catalog.behaviourOf({ categoryKey })).toEqual({
        channels: ['email'],
        classification: 'transactional',
      });
    }
  });

  it('answers a published change on the next poll, and the seeded behaviour again after one revert', async () => {
    const { store, catalog } = await replicaCatalog();
    const scope = NOTIFICATION_CATEGORY.INVITATION;
    const seeded = store.get({ kind: NOTIFICATION_CATEGORY_CONFIG_KIND, scope });
    if (!seeded) throw new Error(`the seed loader published no ${NOTIFICATION_CATEGORY_CONFIG_KIND}/${scope}`);

    try {
      await publisher.publish({
        kind: NOTIFICATION_CATEGORY_CONFIG_KIND,
        scope,
        // Transactional: the invitation is mandatory since task 49.3, so an `optional` artefact is refused — the
        // change under test is the channels, which an operator may publish.
        payload: { channels: ['in_app', 'email'], classification: 'transactional' },
        expectedRevision: seeded.revision,
      });

      // The replica is not told: it finds out the way every running process does.
      expect(await store.refreshIfStale()).toBe(true);
      expect(catalog.behaviourOf({ categoryKey: scope })).toEqual({
        channels: ['in_app', 'email'],
        classification: 'transactional',
      });
    } finally {
      await publisher.revert({ kind: NOTIFICATION_CATEGORY_CONFIG_KIND, scope, toRevision: seeded.revision });
    }

    await store.refreshIfStale();
    expect(catalog.behaviourOf({ categoryKey: scope })).toEqual({
      channels: ['email'],
      classification: 'transactional',
    });
    expect(store.get({ kind: NOTIFICATION_CATEGORY_CONFIG_KIND, scope })?.revision).toBe(seeded.revision);
  });
});
