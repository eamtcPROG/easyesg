import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '@api/config/configuration';
import {
  ADMIN_READONLY_DATA_SOURCE,
  BILLING_DATA_SOURCE,
  CORE_DATA_SOURCE,
  adminReadOnlyDataSourceOptions,
  billingDataSourceOptions,
  coreDataSourceOptions,
} from './data-source';

const config: AppConfig = {
  mode: 'http',
  port: 3000,
  billingEnabled: true,
  database: {
    host: 'db',
    port: 5432,
    name: 'esg',
    user: 'esg_app',
    password: 'not-a-real-password',
    adminReadOnly: { user: 'esg_admin_ro', password: 'not-a-real-password' },
  },
  redis: { host: 'redis', port: 6379 },
  // Task 19's settings. None of them reaches a DataSource, which is the point of listing them:
  // AppConfig is one shape and this fixture is the whole of it, so a key added for one subsystem
  // cannot quietly become a connection option for another.
  auth: {
    passwordPepper: 'not-a-real-pepper',
    jwtSecret: 'not-a-real-secret',
    adminSecret: 'not-a-real-admin-secret',
    social: {
      allowInsecureIssuers: false,
      google: { clientSecret: 'not-a-real-secret' },
      microsoft: { clientSecret: 'not-a-real-secret' },
    },
  },
  secrets: { encryptionKey: 'not-a-real-encryption-key' },
  notification: { unsubscribeSigningKey: 'not-a-real-signing-key' },
  admin: { origin: 'http://localhost:3200' },
  email: {
    provider: 'log',
    smtp: { host: undefined, port: 587, user: undefined, password: undefined, from: undefined },
  },
  web: { publicUrl: 'http://localhost:3100' },
};

/**
 * AD-14's constraints written as assertions rather than as prose someone has to remember.
 *
 * Each of these regresses silently. `synchronize: true` does not fail — it "helpfully" drops
 * the RLS policies, grants and triggers it cannot describe, and the first symptom is a
 * cross-tenant read succeeding. `migrationsRun: true` does not fail either; it makes an
 * application container try DDL it has no privilege for, at boot, in whichever environment
 * restarts first.
 */
describe('runtime data source options', () => {
  const sources = [
    ['core', coreDataSourceOptions(config), 'core'],
    ['billing', billingDataSourceOptions(config), 'billing'],
  ] as const;

  it.each(sources)('%s never synchronizes (AD-14 constraint 1)', (_label, options) => {
    expect(options.synchronize).toBe(false);
    expect(options.dropSchema).toBe(false);
  });

  it.each(sources)('%s runs no migrations — that is the owner role, not this one', (_l, options) => {
    expect(options.migrations).toEqual([]);
    expect(options.migrationsRun).toBe(false);
  });

  it.each(sources)('%s is bound to its own schema (DR-1, §7.1)', (_label, options, schema) => {
    expect(options).toMatchObject({ type: 'postgres', schema });
  });

  // DataSourceOptions is a union across every driver TypeORM supports, and `schema` exists on
  // only some of them — so reading it needs the `in` narrowing rather than a direct access.
  const schemaOf = (options: DataSourceOptions): string | undefined =>
    'schema' in options ? options.schema : undefined;

  it('keeps the two contexts on separate schemas, so a cross-context relation cannot be declared', () => {
    expect(schemaOf(coreDataSourceOptions(config))).not.toBe(
      schemaOf(billingDataSourceOptions(config)),
    );
  });

  it('names the two connections distinctly for the tokens task 11 injects by', () => {
    expect(CORE_DATA_SOURCE).not.toBe(BILLING_DATA_SOURCE);
  });

  /**
   * `@nestjs/typeorm` 11.0.3 resolves the shutdown token from the factory *result*, not from the
   * module options — so options with no `name` resolve the default token, which does not exist
   * when every data source is named, and `onApplicationShutdown` throws before destroying
   * anything. `main.http.ts` enables shutdown hooks, so that is a failed SIGTERM in production,
   * not a test-only annoyance.
   */
  it.each(sources)('%s carries its name, which @nestjs/typeorm needs at shutdown', (_l, o, n) => {
    expect(o).toMatchObject({ name: n });
  });

  it.each(sources)('%s bounds concurrency explicitly rather than by inherited default', (_l, o) => {
    // §12.5: four pools at peak across api and worker, 40 of max_connections 100.
    expect(o).toMatchObject({ poolSize: 10 });
  });

  it('never enables the query-result cache, TypeORM’s one ioredis consumer', () => {
    expect(coreDataSourceOptions(config)).not.toHaveProperty('cache');
    expect(billingDataSourceOptions(config)).not.toHaveProperty('cache');
  });

  it('distinguishes the http and worker tiers in pg_stat_activity', () => {
    const worker = coreDataSourceOptions({ ...config, mode: 'worker' });
    expect(worker).toMatchObject({ applicationName: 'easyesg-worker-core' });
    expect(coreDataSourceOptions(config)).toMatchObject({ applicationName: 'easyesg-http-core' });
  });

  /**
   * `esg_admin_ro`'s connection (task 67.3) — the `BYPASSRLS` role, so the constraints above matter
   * more here, not less, and two of its own: it refuses to exist without its credentials, and it is
   * the role the options name rather than the tier's.
   */
  describe('the admin read-only connection', () => {
    const options = adminReadOnlyDataSourceOptions(config);

    it('never synchronizes and runs no migrations', () => {
      expect(options).toMatchObject({ synchronize: false, dropSchema: false, migrationsRun: false });
      expect(options.migrations).toEqual([]);
    });

    it('connects as esg_admin_ro, never as the tier’s own role', () => {
      expect(options).toMatchObject({ username: 'esg_admin_ro', name: ADMIN_READONLY_DATA_SOURCE });
      expect(ADMIN_READONLY_DATA_SOURCE).not.toBe(CORE_DATA_SOURCE);
    });

    it('holds a pool of two, outside the four application pools', () => {
      expect(options).toMatchObject({ poolSize: 2, applicationName: 'easyesg-http-admin-readonly' });
    });

    it('refuses to build without both credentials, naming them', () => {
      for (const adminReadOnly of [
        { user: undefined, password: 'x' },
        { user: 'esg_admin_ro', password: undefined },
        { user: '', password: '' },
      ]) {
        expect(() =>
          adminReadOnlyDataSourceOptions({ ...config, database: { ...config.database, adminReadOnly } }),
        ).toThrow(/DB_ADMIN_RO_USER and DB_ADMIN_RO_PASSWORD/u);
      }
    });
  });
});
