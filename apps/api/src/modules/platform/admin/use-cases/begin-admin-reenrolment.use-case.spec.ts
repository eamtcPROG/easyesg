import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminReauthenticationFailedError } from '../errors/admin-credentials.errors';
import { FakeAdminCredentialStore } from '../testing/admin-credential-store.fake';
import { BeginAdminReenrolment } from './begin-admin-reenrolment.use-case';

/** UC-212 step two, first half (task 144) — a new factor staged beside the one in force. */
const NOW = new Date('2026-09-14T10:00:00Z');
const PASSWORD = 'Parola123!';

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const setUp = () => {
  const store = new FakeAdminCredentialStore();
  const operator = store.seedAccount({ passwordHash: `hashed:${PASSWORD}` });
  return { store, operator, begin: new BeginAdminReenrolment(store, fakeHasher, () => NOW) };
};

describe('BeginAdminReenrolment (UC-212, task 144)', () => {
  it('stages a new secret beside the factor in force, and answers it with its enrolment URI', async () => {
    const { store, operator, begin } = setUp();

    const offer = await begin.execute({ accountId: operator.id, password: PASSWORD });

    const stored = store.accountById(operator.id);
    expect(stored?.stagedTotpSecret).toBe(offer.secret);
    // The factor in force still signs the operator in until a code confirms the new one.
    expect(stored?.totpSecret).toBe(operator.totpSecret);
    expect(offer.secret).not.toBe(operator.totpSecret);
    expect(offer.uri).toMatch(/^otpauth:\/\/totp\//u);
    expect(offer.uri).toContain(offer.secret);
  });

  it('replaces an earlier staging with a fresh secret on a second call', async () => {
    const { store, operator, begin } = setUp();

    const first = await begin.execute({ accountId: operator.id, password: PASSWORD });
    const second = await begin.execute({ accountId: operator.id, password: PASSWORD });

    expect(second.secret).not.toBe(first.secret);
    expect(store.accountById(operator.id)?.stagedTotpSecret).toBe(second.secret);
  });

  it('refuses a wrong password and stages nothing', async () => {
    const { store, operator, begin } = setUp();

    await expect(begin.execute({ accountId: operator.id, password: 'Gresita1!' })).rejects.toBeInstanceOf(
      AdminReauthenticationFailedError,
    );
    expect(store.accountById(operator.id)?.stagedTotpSecret).toBeNull();
  });
});
