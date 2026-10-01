import { Global, Module } from '@nestjs/common';
import { ConfigurationHistory } from './configuration-history.service';
import { ConfigurationPublisher } from './configuration-publisher.service';
import { ConfigurationStore } from './configuration-store.service';

/**
 * The configuration store (DR-3, AD-4), global because almost every module reads it: task 33's
 * taxonomy, 37's factor sets, 40's validation rules, 49's notification behaviour and 53's plans all
 * consult it, and none of them owns it.
 *
 * Registered in both modes. The worker needs the read model as much as the API does — it renders
 * exports against a pinned taxonomy version and evaluates rules — and the poll is one query against
 * a one-row table.
 *
 * `ConfigurationHistory` sits beside the read model rather than inside it (task 37.2): the store caches what is in
 * force, and a pinned calculation must read a version that no longer is.
 */
@Global()
@Module({
  providers: [ConfigurationStore, ConfigurationPublisher, ConfigurationHistory],
  exports: [ConfigurationStore, ConfigurationPublisher, ConfigurationHistory],
})
export class ConfigurationStoreModule {}
