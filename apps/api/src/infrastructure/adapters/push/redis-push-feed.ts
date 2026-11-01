import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '@api/config/configuration';
import { PUSH_CHANNEL } from '@api/modules/platform/push/constants/push.constants';
import { readPushHint, type PushHint } from '@api/modules/platform/push/domain/push-hint';
import type { PushFeed } from '@api/modules/platform/push/interfaces/push-feed.interface';

/**
 * `PUSH_FEED` over Redis pub/sub (task 148): what an api replica hears of the worker's hints. **Subscribed only once the
 * replica holds a socket** — the gateway starts it with its first connection, as the presence does — so an idle replica
 * and every api suite open no connection. A message that is not a hint this release can route is dropped with a
 * warning, never thrown: one malformed publish must not stop the next.
 */
@Injectable()
export class RedisPushFeed implements PushFeed, OnModuleDestroy {
  private readonly logger = new Logger(RedisPushFeed.name);
  private readonly options: { host: string; port: number };
  private subscriber: Redis | undefined;
  private started: Promise<void> | undefined;

  constructor(config: ConfigService<AppConfig, true>) {
    this.options = { host: config.get('redis.host', { infer: true }), port: config.get('redis.port', { infer: true }) };
  }

  start(deliver: (hint: PushHint) => void): Promise<void> {
    this.started ??= (async () => {
      this.subscriber = new Redis(this.options);
      this.subscriber.on('message', (_channel: string, message: string) => {
        const hint = parse(message);
        if (hint === null) this.logger.warn('Dropped a push hint this release cannot route.');
        else deliver(hint);
      });
      await this.subscriber.subscribe(PUSH_CHANNEL);
    })();
    return this.started;
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }
}

const parse = (message: string): PushHint | null => {
  try {
    const raw = JSON.parse(message) as Record<string, unknown>;
    return readPushHint({
      event: raw.event,
      organizationId: raw.organizationId,
      accountIds: raw.accountIds,
      since: new Date(typeof raw.since === 'number' ? raw.since : Number.NaN),
    });
  } catch {
    return null;
  }
};
