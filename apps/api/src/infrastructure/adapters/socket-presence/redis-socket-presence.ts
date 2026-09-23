import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '@api/config/configuration';
import { SOCKET_LIMIT } from '@api/modules/platform/push/constants/socket.constants';
import type { SocketPresence } from '@api/modules/platform/push/interfaces/socket-presence.interface';

const KEY = {
  /** An account's live connections: members `<replica>:<connection>`, scored by connect time. */
  connections: (accountId: string) => `socket-connections:${accountId}`,
  /** Present while a replica is alive; the script prunes the entries of one that is not. */
  REPLICA_PREFIX: 'socket-replica:',
  /** A replica's own channel, on which it is told which of its connections to close. */
  eviction: (replicaId: string) => `socket-evict:${replicaId}`,
} as const;

/** A replica missing three heartbeats is dead, and its connections no longer count. */
const REPLICA_TTL_SECONDS = (SOCKET_LIMIT.HEARTBEAT_MS * 3) / 1000;

/**
 * Count one connection against the cap, atomically — **one script**, so two replicas admitting the same account's
 * eleventh and twelfth connections at once cannot both leave eleven. It drops the entries of replicas whose liveness
 * key has gone, adds the new member at `now`, and pops the oldest past the cap, answering them as
 * `[member, score, member, score, …]`. **The script reads keys it does not declare** (the replicas'), which a Redis
 * Cluster would refuse; §5.4's Redis is one instance, and this line is what changes if it ever is not.
 */
const REGISTER = `
local members = redis.call('ZRANGE', KEYS[1], 0, -1)
for _, member in ipairs(members) do
  local replica = string.match(member, '^([^:]+):')
  if replica == nil or redis.call('EXISTS', ARGV[4] .. replica) == 0 then
    redis.call('ZREM', KEYS[1], member)
  end
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
local excess = redis.call('ZCARD', KEYS[1]) - tonumber(ARGV[3])
if excess > 0 then
  return redis.call('ZPOPMIN', KEYS[1], excess)
end
return {}
`;

/**
 * `SOCKET_PRESENCE` over Redis (task 147; §12.5.6's task-147 edge row) — the cap across replicas.
 *
 * **Nothing until the first socket**: a replica that never holds one opens no connection, sets no liveness key and
 * subscribes to nothing — which keeps every api suite and every idle replica off Redis. From the first registration it
 * holds two connections, since a subscribed connection can issue no other command: one for commands, one for its own
 * eviction channel. **The replica's id is per process**, so a restart is a new replica and the old one's entries are
 * pruned once its liveness key lapses.
 *
 * **A failure fails open, and says so**: an unreachable Redis leaves the connection uncounted and logs it, because the
 * socket is an accelerator and the edge still bounds it (§12.5.6's task-147 edge row). **A removal that fails is
 * retried on every liveness tick until it lands**, so a connection closed while Redis was away stops counting within a
 * heartbeat of Redis's return — rather than holding one of its account's ten places for as long as this replica lives.
 */
@Injectable()
export class RedisSocketPresence implements SocketPresence, OnModuleDestroy {
  private readonly logger = new Logger(RedisSocketPresence.name);
  private readonly replicaId = randomUUID();
  private readonly options: { host: string; port: number };
  private commands: Redis | undefined;
  private subscriber: Redis | undefined;
  private started: Promise<void> | undefined;
  private liveness: NodeJS.Timeout | undefined;
  private evict: (connectionId: string) => void = () => undefined;
  /** Removals that did not reach Redis, by member — retried on each liveness tick. */
  private readonly unremoved = new Map<string, string>();

  constructor(config: ConfigService<AppConfig, true>) {
    this.options = { host: config.get('redis.host', { infer: true }), port: config.get('redis.port', { infer: true }) };
  }

  onEviction(handler: (connectionId: string) => void): void {
    this.evict = handler;
  }

  async register(input: { readonly accountId: string; readonly connectionId: string }): Promise<void> {
    try {
      const commands = await this.start();
      const popped = (await commands.eval(
        REGISTER,
        1,
        KEY.connections(input.accountId),
        this.member(input.connectionId),
        Date.now(),
        SOCKET_LIMIT.CONNECTIONS_PER_ACCOUNT,
        KEY.REPLICA_PREFIX,
      )) as string[];
      for (let index = 0; index < popped.length; index += 2) {
        const [replicaId, connectionId] = popped[index].split(':');
        await commands.publish(KEY.eviction(replicaId), connectionId);
      }
    } catch (error) {
      this.logger.error(`Socket not counted against its account's cap: ${describe(error)}`);
    }
  }

  async unregister(input: { readonly accountId: string; readonly connectionId: string }): Promise<void> {
    // A registration that never reached Redis added nothing, so there is nothing to remove — the gateway awaits the
    // registration before asking, so this is never a removal overtaking its own registration.
    if (this.commands === undefined) return;
    const member = this.member(input.connectionId);
    const key = KEY.connections(input.accountId);
    try {
      await this.commands.zrem(key, member);
    } catch (error) {
      this.unremoved.set(member, key);
      this.logger.error(`Socket not yet uncounted from its account's cap; retried each heartbeat: ${describe(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.liveness);
    if (this.commands === undefined) return;
    await this.commands.del(`${KEY.REPLICA_PREFIX}${this.replicaId}`).catch(() => undefined);
    await this.commands.quit().catch(() => undefined);
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** The liveness key refreshed, and every removal that failed before retried — one tick of the heartbeat. */
  private async alive(): Promise<void> {
    const commands = this.commands;
    if (commands === undefined) return;
    await commands.set(`${KEY.REPLICA_PREFIX}${this.replicaId}`, '1', 'EX', REPLICA_TTL_SECONDS);
    for (const [member, key] of this.unremoved) {
      await commands.zrem(key, member);
      this.unremoved.delete(member);
    }
  }

  private member(connectionId: string): string {
    return `${this.replicaId}:${connectionId}`;
  }

  /** The two connections, the liveness key and the eviction subscription — once, on the first socket. */
  private async start(): Promise<Redis> {
    this.started ??= (async () => {
      this.commands = new Redis(this.options);
      this.subscriber = new Redis(this.options);
      this.subscriber.on('message', (_channel: string, connectionId: string) => this.evict(connectionId));
      await this.subscriber.subscribe(KEY.eviction(this.replicaId));
      await this.alive();
      this.liveness = setInterval(() => void this.alive().catch(() => undefined), SOCKET_LIMIT.HEARTBEAT_MS);
      this.liveness.unref();
    })();
    await this.started;
    if (this.commands === undefined) throw new Error('the presence connection did not open');
    return this.commands;
  }
}

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
