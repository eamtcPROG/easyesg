import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../../config/configuration';
import {
  BILLING_DATA_SOURCE,
  CORE_DATA_SOURCE,
  billingDataSourceOptions,
  coreDataSourceOptions,
} from './data-source';

const config: AppConfig = {
  mode: 'http',
  port: 3000,
  billingEnabled: true,
  database: { host: 'db', port: 5432, name: 'esg', user: 'esg_app', password: 'secret' },
  redis: { host: 'redis', port: 6379 },
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

  it('never enables the query-result cache, TypeORM’s one ioredis consumer', () => {
    expect(coreDataSourceOptions(config)).not.toHaveProperty('cache');
    expect(billingDataSourceOptions(config)).not.toHaveProperty('cache');
  });

  it('distinguishes the http and worker tiers in pg_stat_activity', () => {
    const worker = coreDataSourceOptions({ ...config, mode: 'worker' });
    expect(worker).toMatchObject({ applicationName: 'easyesg-worker-core' });
    expect(coreDataSourceOptions(config)).toMatchObject({ applicationName: 'easyesg-http-core' });
  });
});
