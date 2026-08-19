import { hash, verify } from '@node-rs/argon2';

/**
 * Binding canary for @node-rs/argon2 (architecture.md §12.1, Auth — password hashing).
 *
 * A missing platform prebuild surfaces at require-time, not install-time, so this spec
 * exists to fail the ordinary test run rather than the first login attempt. If it breaks
 * after an environment change, §12.6 control 3 applies: suspect the Node version before
 * the dependency. Argon2id parameters (memory, iterations, parallelism — §9.1) are
 * identity-phase work and deliberately not asserted here.
 *
 * The `$argon2id$` prefix assertion is load-bearing: the library's exported `Algorithm`
 * const enum is ambient and unusable under `isolatedModules`, so §9.1 rests on the
 * documented default being Argon2id — this is the test that notices if a bump changes it.
 */
describe('@node-rs/argon2 binding', () => {
  it('produces and round-trips an Argon2id hash by default', async () => {
    const digest = await hash('correct horse battery staple');
    expect(digest).toMatch(/^\$argon2id\$/);
    await expect(verify(digest, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verify(digest, 'wrong password')).resolves.toBe(false);
  });

  it('accepts a secret, which is how the §9.1 pepper will be supplied', async () => {
    const secret = Buffer.from('not-a-real-pepper');
    const digest = await hash('pw', { secret });
    await expect(verify(digest, 'pw', { secret })).resolves.toBe(true);
    await expect(verify(digest, 'pw')).resolves.toBe(false);
  });
});
