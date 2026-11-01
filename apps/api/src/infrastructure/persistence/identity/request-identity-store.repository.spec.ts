import type { DataSource } from 'typeorm';
import { RequestIdentityStoreRepository } from './request-identity-store.repository';

/**
 * The tenant session lookup's one guard, hermetic (task 162). A token's `sub` is whatever was signed, and
 * `identity.session.id` is a `uuid` column, so a forged `sub: "hello"` must answer *no identity* — a 401 — before
 * any query, rather than PostgreSQL's `invalid input syntax for type uuid` as a 500. **It had no test until task
 * 162**, whose mutation of the shared shape check found this the one site nothing else noticed.
 */
describe('RequestIdentityStoreRepository — a session id that cannot be a uuid (task 162)', () => {
  const REACHED = 'the lookup reached the database';

  const build = () => {
    const createQueryRunner = jest.fn(() => {
      throw new Error(REACHED);
    });
    return {
      store: new RequestIdentityStoreRepository({ createQueryRunner } as unknown as DataSource),
      createQueryRunner,
    };
  };

  it.each(['hello', '', '3f2c8a8e-1b7a-4c1e-9f2a-6d4b3e2a1c0', "' OR 1=1 --"])(
    'answers no identity for %p without opening a connection',
    async (sessionId) => {
      const { store, createQueryRunner } = build();

      await expect(store.resolve(sessionId)).resolves.toBeNull();
      expect(createQueryRunner).not.toHaveBeenCalled();
    },
  );

  // The other direction, so the guard cannot pass by refusing everything.
  it('takes an id that is a uuid to the database', async () => {
    const { store, createQueryRunner } = build();

    await expect(store.resolve('01920000-0000-7000-8000-0000000000c1')).rejects.toThrow(REACHED);
    expect(createQueryRunner).toHaveBeenCalledTimes(1);
  });
});
