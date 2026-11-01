import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { RedisSocketPresence } from './redis-socket-presence';

/**
 * A removal that fails is retried until it lands (task 147, the owner's review): a connection closed while Redis was
 * unreachable must stop counting against its account once Redis is back, not hold a place for the replica's lifetime.
 * Over a fake client, because a Redis that fails on cue is not something the e2e stack can be asked for.
 */
const zrem = jest.fn<Promise<number>, [string, string]>();

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    eval: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(1),
    zrem,
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  })),
}));

describe('RedisSocketPresence (task 147)', () => {
  const config = { get: (key: string) => (key === 'redis.host' ? 'redis' : 6379) } as unknown as ConfigService<AppConfig, true>;
  const connection = { accountId: 'account-ana', connectionId: 'connection-1' };

  beforeEach(() => {
    jest.useFakeTimers();
    zrem.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  it('retries a failed removal on the next heartbeat, and stops once it lands', async () => {
    const presence = new RedisSocketPresence(config);
    await presence.register(connection);

    zrem.mockRejectedValueOnce(new Error('Redis is away')).mockResolvedValue(1);
    await presence.unregister(connection);
    expect(zrem).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(zrem).toHaveBeenCalledTimes(2);
    expect(zrem).toHaveBeenLastCalledWith('socket-connections:account-ana', expect.stringMatching(/:connection-1$/u));

    await jest.advanceTimersByTimeAsync(30_000);
    expect(zrem).toHaveBeenCalledTimes(2);
    await presence.onModuleDestroy();
  });

  it('removes nothing for a connection that never registered', async () => {
    const presence = new RedisSocketPresence(config);
    await presence.unregister(connection);

    expect(zrem).not.toHaveBeenCalled();
  });
});
