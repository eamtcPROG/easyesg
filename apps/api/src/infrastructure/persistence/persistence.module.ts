import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { type AppConfig } from '../../config/configuration';
import {
  BILLING_DATA_SOURCE,
  CORE_DATA_SOURCE,
  billingDataSourceOptions,
  coreDataSourceOptions,
} from './data-source';

/**
 * Registers AD-14's two `DataSource`s. Deferred to task 11 rather than task 9 because this is what
 * makes the app need a database at boot, and nothing needed a connection until now.
 *
 * **`billing` is registered only when the context is enabled, and that is NFR-1's mechanism.**
 * With `BILLING_ENABLED=false` the compliance core must still pass UC-17…48 end to end, and the
 * honest way to test it is for the connection not to exist — not for it to exist and go unused. It
 * also makes a cross-context entity relation impossible to *declare* rather than merely forbidden
 * (DR-1): there is no second `DataSource` to name.
 *
 * `@Global` so `@InjectDataSource(CORE_DATA_SOURCE)` resolves from `app/` without every consumer
 * re-importing this module. The tenant transaction is a cross-cutting obligation discharged once
 * at the request edge (§6.2), not a per-module dependency.
 */

/**
 * Read at module-definition time, which is the one thing `ConfigService` cannot serve: whether a
 * module is imported has to be decided before dependency injection exists to answer it. This calls
 * the same `configuration()` factory `ConfigModule` is given, so there is one parse of the
 * environment shape and not two readings of `process.env` that could disagree.
 */
const { billingEnabled } = configuration();

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: CORE_DATA_SOURCE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        coreDataSourceOptions(configFrom(config)),
    }),
    ...(billingEnabled
      ? [
          TypeOrmModule.forRootAsync({
            name: BILLING_DATA_SOURCE,
            inject: [ConfigService],
            useFactory: (config: ConfigService<AppConfig, true>) =>
              billingDataSourceOptions(configFrom(config)),
          }),
        ]
      : []),
  ],
})
export class PersistenceModule {}

/**
 * `ConfigService.get` is the accessor the house rule names, and the option factories take the
 * whole `AppConfig` — so this is the one adapter between them, rather than each factory taking a
 * `ConfigService` and coupling `data-source.ts` to Nest.
 */
function configFrom(config: ConfigService<AppConfig, true>): AppConfig {
  return {
    mode: config.get('mode', { infer: true }),
    port: config.get('port', { infer: true }),
    billingEnabled: config.get('billingEnabled', { infer: true }),
    database: config.get('database', { infer: true }),
    redis: config.get('redis', { infer: true }),
  };
}
