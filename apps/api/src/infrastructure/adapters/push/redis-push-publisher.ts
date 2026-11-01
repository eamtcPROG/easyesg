import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '@api/config/configuration';
import type { PushHintCommand, PushPublisher } from '@api/contracts/push.port';
import { PUSH_CHANNEL } from '@api/modules/platform/push/constants/push.constants';

/**
 * `PUSH_PUBLISHER` over Redis pub/sub (task 148; §12.5.6's task-148 row) — **the worker's**, the one publisher AD-15
 * names. Every api replica holding a socket subscribes to `PUSH_CHANNEL`; one that holds none is not listening, and
 * a hint nobody hears costs nothing, because the poll is the authority and **the channel is lossy by design**.
 *
 * **A failure to publish is swallowed**, after the change it announces has already committed: throwing would fail the
 * job that wrote an in-app delivery, or retry a hint whose moment has passed. **Lazily connected**, so a worker that
 * publishes nothing opens nothing.
 */
@Injectable()
export class RedisPushPublisher implements PushPublisher, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService<AppConfig, true>) {
    this.redis = new Redis({
      host: config.get('redis.host', { infer: true }),
      port: config.get('redis.port', { infer: true }),
      lazyConnect: true,
    });
  }

  async publish(command: PushHintCommand & { readonly since?: Date }): Promise<void> {
    const since = (command.since ?? new Date()).getTime();
    const message = 'accountIds' in command
      ? { event: command.event, organizationId: command.organizationId, accountIds: command.accountIds, since }
      : { event: command.event, organizationId: command.organizationId, since };
    await this.redis.publish(PUSH_CHANNEL, JSON.stringify(message)).catch(() => undefined);
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
