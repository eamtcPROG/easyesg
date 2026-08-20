import { DataSource } from 'typeorm';
import { seedConfiguration } from './seed-configuration';

/**
 * Entrypoint for `pnpm --filter @easyesg/api config:seed`.
 *
 * Connects as `esg_app` rather than the migration owner: publishing configuration is an ordinary
 * application write (the admin console does the same through the API), and the migration owner's
 * credentials are not available to a runtime process by design (§7.7).
 */
async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'postgres',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: process.env.DB_USER ?? 'esg_app',
    password: process.env.DB_PASSWORD ?? '',
    synchronize: false,
    entities: [],
    applicationName: 'easyesg-config-seed',
  });

  await dataSource.initialize();
  try {
    for (const outcome of await seedConfiguration(dataSource)) {
      const verb = outcome.published ? `published revision ${outcome.revision}` : 'unchanged';
      process.stdout.write(`${outcome.kind}/${outcome.scope}: ${verb}\n`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void main();
