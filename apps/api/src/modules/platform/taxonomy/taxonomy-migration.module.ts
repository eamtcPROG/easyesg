import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { NOTIFICATION_PORT, type NotificationPort } from '@api/contracts/notification.port';
import { TAXONOMY_MAPPINGS, type TaxonomyMappings } from '@api/contracts/taxonomy-mapping.port';
import { TENANT_WORK, type TenantWork } from '@api/contracts/tenant-work.port';
import { AdminReadOnly } from '@api/infrastructure/persistence/admin-readonly';
import { ReportMigrationsRepository } from '@api/infrastructure/persistence/core/report-migrations.repository';
import { MigrationRunDirectoryRepository } from '@api/infrastructure/persistence/platform/migration-run-directory.repository';
import { MigrationRunStoreRepository } from '@api/infrastructure/persistence/platform/migration-run-store.repository';
import { WorkerTenantWork } from '@api/infrastructure/persistence/worker-tenant-work';
import { NotificationModule } from '../notification/notification.module';
import { MigrationRunRequestedHandler } from './consumers/migration-run-requested.handler';
import { MigrationRunRevertedHandler } from './consumers/migration-run-reverted.handler';
import { MIGRATION_RUN_DIRECTORY, type MigrationRunDirectory } from './interfaces/migration-run-directory.interface';
import { MIGRATION_RUN_STORE, type MigrationRunStore } from './interfaces/migration-run-store.interface';
import { REPORT_MIGRATIONS, type ReportMigrations } from './interfaces/report-migrations.interface';
import { TAXONOMY_CONSOLE_STORE, type TaxonomyConsoleStore } from './interfaces/taxonomy-console-store.interface';
import { MigrationRunService } from './services/migration-run.service';
import { TaxonomyConsoleModule } from './taxonomy-console.module';
import { TaxonomyModule } from './taxonomy.module';
import { ExecuteMigrationRun } from './use-cases/execute-migration-run.use-case';
import { PreviewMigrationRun } from './use-cases/preview-migration-run.use-case';
import { ReadMigrationRun } from './use-cases/read-migration-run.use-case';
import { ReadMigrationRuns } from './use-cases/read-migration-runs.use-case';
import { RetryMigrationRun } from './use-cases/retry-migration-run.use-case';
import { RevertMigrationRunReports } from './use-cases/revert-migration-run-reports.use-case';
import { RevertMigrationRun } from './use-cases/revert-migration-run.use-case';
import { StartMigrationRun } from './use-cases/start-migration-run.use-case';

/**
 * A taxonomy migration run, both halves (tasks 67.23, 67.24; UC-78; FR-69, FR-70; 182/41 … 182/43; §12.5.6's
 * task-67.23 and task-67.24 rows). **The request tier** starts, reads, retries and reverts a run — its service exported
 * for the admin realm's controller, which `AdminModule` imports this module for. **The worker** executes and reverts
 * one, one transaction per report through `TENANT_WORK`, and raises each organization's notice — which is why the
 * platform barrel imports this module too: `AdminModule` builds none of it in `MODE=worker`.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  AdminReadOnly,
  { provide: MIGRATION_RUN_STORE, useClass: MigrationRunStoreRepository },
  {
    provide: PreviewMigrationRun,
    inject: [TAXONOMY_CONSOLE_STORE, TAXONOMY_MAPPINGS, MIGRATION_RUN_STORE],
    useFactory: (store: TaxonomyConsoleStore, mappings: TaxonomyMappings, runs: MigrationRunStore) =>
      new PreviewMigrationRun(store, mappings, runs),
  },
  {
    provide: StartMigrationRun,
    inject: [TAXONOMY_CONSOLE_STORE, TAXONOMY_MAPPINGS, MIGRATION_RUN_STORE],
    useFactory: (store: TaxonomyConsoleStore, mappings: TaxonomyMappings, runs: MigrationRunStore) =>
      new StartMigrationRun(store, mappings, runs),
  },
  { provide: ReadMigrationRuns, inject: [MIGRATION_RUN_STORE], useFactory: (runs: MigrationRunStore) => new ReadMigrationRuns(runs) },
  { provide: ReadMigrationRun, inject: [MIGRATION_RUN_STORE], useFactory: (runs: MigrationRunStore) => new ReadMigrationRun(runs) },
  { provide: RetryMigrationRun, inject: [MIGRATION_RUN_STORE], useFactory: (runs: MigrationRunStore) => new RetryMigrationRun(runs) },
  { provide: RevertMigrationRun, inject: [MIGRATION_RUN_STORE], useFactory: (runs: MigrationRunStore) => new RevertMigrationRun(runs) },
  MigrationRunService,
];

const workerProviders: Provider[] = [
  { provide: MIGRATION_RUN_DIRECTORY, useClass: MigrationRunDirectoryRepository },
  { provide: REPORT_MIGRATIONS, useClass: ReportMigrationsRepository },
  { provide: TENANT_WORK, useClass: WorkerTenantWork },
  {
    provide: ExecuteMigrationRun,
    inject: [MIGRATION_RUN_DIRECTORY, REPORT_MIGRATIONS, TENANT_WORK, NOTIFICATION_PORT],
    useFactory: (directory: MigrationRunDirectory, migrations: ReportMigrations, work: TenantWork, notifications: NotificationPort) =>
      new ExecuteMigrationRun(directory, migrations, work, notifications),
  },
  {
    provide: RevertMigrationRunReports,
    inject: [MIGRATION_RUN_DIRECTORY, REPORT_MIGRATIONS, TENANT_WORK, NOTIFICATION_PORT],
    useFactory: (directory: MigrationRunDirectory, migrations: ReportMigrations, work: TenantWork, notifications: NotificationPort) =>
      new RevertMigrationRunReports(directory, migrations, work, notifications),
  },
  MigrationRunRequestedHandler,
  MigrationRunRevertedHandler,
];

@Module({
  imports: mode === APP_MODE.WORKER ? [NotificationModule] : [TaxonomyModule, TaxonomyConsoleModule],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  exports: mode === APP_MODE.WORKER ? [] : [MigrationRunService],
})
export class TaxonomyMigrationModule {}
