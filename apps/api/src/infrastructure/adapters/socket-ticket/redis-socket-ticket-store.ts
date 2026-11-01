import { createHash, randomBytes } from 'node:crypto';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '@api/config/configuration';
import type { SocketTicketStore } from '@api/modules/platform/push/interfaces/socket-ticket-store.interface';

/** ioredis's status before a lazily connected client has sent anything — its spelling, named here. */
const REDIS_STATUS = { NEVER_CONNECTED: 'wait' } as const;

/** Every ticket key is under this prefix, so a key names what it holds when read in `redis-cli`. */
const KEY_PREFIX = 'socket-ticket:';

/**
 * `SOCKET_TICKET_STORE` over Redis (task 147; §12.5.6's task-147 ticket row) — **the owner's choice over a table**: a
 * key that expires by itself in thirty seconds and is consumed by `GETDEL`, so single use is one atomic command and
 * nothing needs sweeping. Redis is never a system of record here (§5.4): a lost ticket costs one reconnect.
 *
 * **The key is the ticket's SHA-256, never the ticket**, the way every token table in `identity` holds a hash — so a
 * memory dump or a `MONITOR` session hands over nothing usable. The ticket itself is 32 random bytes, base64url.
 *
 * **Its own connection**, not BullMQ's: those belong to the queue, and a ticket read must not queue behind a blocked
 * worker command. Closed with the module.
 */
@Injectable()
export class RedisSocketTicketStore implements SocketTicketStore, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService<AppConfig, true>) {
    this.redis = new Redis({
      host: config.get('redis.host', { infer: true }),
      port: config.get('redis.port', { infer: true }),
      lazyConnect: true,
    });
  }

  async issue(input: { readonly sessionId: string; readonly ttlSeconds: number }): Promise<string> {
    const ticket = randomBytes(32).toString('base64url');
    await this.redis.set(keyOf(ticket), input.sessionId, 'EX', input.ttlSeconds);
    return ticket;
  }

  consume(input: { readonly ticket: string }): Promise<string | null> {
    return this.redis.getdel(keyOf(input.ticket));
  }

  /**
   * **Lazily connected**, so a replica that never issued or consumed a ticket never opened one — and closing such a
   * client with `QUIT` would open a connection to say goodbye. It is dropped instead; a connected one quits cleanly.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === REDIS_STATUS.NEVER_CONNECTED) {
      this.redis.disconnect();
      return;
    }
    await this.redis.quit().catch(() => undefined);
  }
}

const keyOf = (ticket: string): string => `${KEY_PREFIX}${createHash('sha256').update(ticket).digest('hex')}`;
