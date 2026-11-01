import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import configuration, { APP_MODE } from '@api/config/configuration';
import { ScheduleTicker } from './schedule-ticker.service';

/**
 * The scheduler, **on the worker entrypoint only** (task 51.2), for `OutboxModule`'s reason: the HTTP tier produces
 * nothing onto the queue, and a scheduled run is a row the dispatcher — itself worker-only — queues.
 */
const { mode } = configuration();

@Module({
  imports: [DiscoveryModule],
  providers: mode === APP_MODE.WORKER ? [ScheduleTicker] : [],
})
export class ScheduleModule {}
