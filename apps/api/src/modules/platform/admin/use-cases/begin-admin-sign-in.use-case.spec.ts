import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  AdminAccountLockedError,
  AdminCredentialInvalidError,
} from '../errors/admin-session.errors';
import { ADMIN_ROLE, type AdminAccount } from '../models/admin-session.model';
import { FakeAdminSessionStore ,
  FakeSystemAuditLog,
} from '../testing/admin-session-store.fake';
import {
  AUDIT_ACTION,
  auditSubject,
} from '@api/modules/platform/audit/models/audit-action.model';
import { BeginAdminSignIn } from './begin-admin-sign-in.use-case';

/** UC-68 step one — the credential half of the retired one-shot matrix, semantics unchanged. */
const NOW = new Date('2026-08-24T12:00:00Z');

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const operator = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '00000000-0000-7000-8000-00000000aaaa',
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
  active: true,
  passwordHash: 'hashed:Parola123!',
  totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  failedAttempts: 0,
  lockedAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const command = (overrides: Partial<{ email: string; password: string }> = {}) => ({
  email: 'operator@easyesg.md',
  password: 'Parola123!',
  ...overrides,
});

/** The audit sink defaults, so only the tests that read the log have to build one. */
const build = (store: FakeAdminSessionStore, audit = new FakeSystemAuditLog()) =>
  new BeginAdminSignIn(store, fakeHasher, audit, () => NOW);

describe('BeginAdminSignIn (UC-68 step one, FR-75)', () => {
  it('opens the challenge for a correct credential — and issues NOTHING else', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    const challenge = await build(store).execute(command());

    expect(challenge).toEqual({
      identity: {
        id: operator().id,
        email: 'operator@easyesg.md',
        role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      },
      issuedAt: NOW,
    });
    // No session, no token: the factor still stands between the password and the console.
    expect(store.sessions).toHaveLength(0);
    expect(store.refreshTokens).toHaveLength(0);
  });

  it('does not clear the failure count — only the completed pair does', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 7 }));

    await build(store).execute(command());

    // A verified password ends nothing FR-4's threshold counts: the factor behind it may
    // still be under attack, and step two owns the clear.
    expect(store.accounts[0].failedAttempts).toBe(7);
  });

  it('answers one uniform document for unknown address, deactivated account and wrong password', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(
      operator(),
      operator({
        id: '00000000-0000-7000-8000-00000000bbbb',
        email: 'former@easyesg.md',
        active: false,
      }),
    );
    const begin = build(store);

    await expect(begin.execute(command({ email: 'nobody@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(begin.execute(command({ email: 'former@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(begin.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
  });

  it('locks at the threshold and the lock ends the oracle', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 9 }));

    await expect(build(store).execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    expect(store.accounts[0].lockedAt).not.toBeNull();

    await expect(build(store).execute(command())).rejects.toBeInstanceOf(AdminAccountLockedError);
  });

  it('throttles the sixth processed attempt in the window, uniformly (§12.5.6)', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());
    const begin = build(store);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(begin.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
        AdminCredentialInvalidError,
      );
    }
    await expect(begin.execute(command())).rejects.toBeInstanceOf(AuthRateLimitedError);
    // The refused attempt was not recorded — a block drains, never rolls (auth-throttle.ts).
    expect(store.attempts).toHaveLength(5);
  });

  it('the counters survive the refusal — the use case commits before it throws', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    await expect(build(store).execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    expect(store.accounts[0].failedAttempts).toBe(1);
    expect(store.rollbacks).toBe(0);
  });

  /**
   * FR-81 and task 23's deferral: A-01's LOGGED disclosure is only true if these rows exist.
   *
   * **The refusals are the point.** A log holding only successes answers *who got in* and not *who
   * tried*, which is the question an operator opens it for — and every refusal here throws, so a
   * write enlisted in the caller's transaction would be rolled back by the very event it records.
   */
  describe('the system audit log (FR-81, task 28.4)', () => {
    it('records a credential refusal against an account that exists, attributed', async () => {
      const store = new FakeAdminSessionStore();
      store.accounts.push(operator());
      const audit = new FakeSystemAuditLog();

      await expect(
        build(store, audit).execute(command({ password: 'wrong' })),
      ).rejects.toBeInstanceOf(AdminCredentialInvalidError);

      expect(audit.recorded).toEqual([
        {
          action: AUDIT_ACTION.ADMIN_SIGN_IN_CREDENTIAL_REFUSED,
          actorId: operator().id,
          subject: auditSubject('operator@easyesg.md'),
        },
      ]);
    });

    /**
     * The case the `subject` column exists for. There is no actor to attribute to, so without it
     * the row would say only that *a* failed admin sign-in happened — with nothing to group
     * repeated probing of one address by.
     */
    it('records an unknown address with a subject and no actor', async () => {
      const store = new FakeAdminSessionStore();
      const audit = new FakeSystemAuditLog();

      await expect(
        build(store, audit).execute(command({ email: 'nobody@easyesg.md' })),
      ).rejects.toBeInstanceOf(AdminCredentialInvalidError);

      expect(audit.recorded).toEqual([
        {
          action: AUDIT_ACTION.ADMIN_SIGN_IN_CREDENTIAL_REFUSED,
          actorId: null,
          subject: auditSubject('nobody@easyesg.md'),
        },
      ]);
    });

    /** The subject is a digest of the NORMALISED address, so casing does not split the grouping. */
    it('groups attempts against one address whatever the casing', async () => {
      const store = new FakeAdminSessionStore();
      const audit = new FakeSystemAuditLog();

      await expect(
        build(store, audit).execute(command({ email: 'Operator@EasyESG.md' })),
      ).rejects.toBeInstanceOf(AdminCredentialInvalidError);

      expect(audit.recorded[0].subject).toEqual(auditSubject('operator@easyesg.md'));
    });

    it('holds no address, only its digest', async () => {
      const store = new FakeAdminSessionStore();
      const audit = new FakeSystemAuditLog();

      await expect(
        build(store, audit).execute(command({ email: 'nobody@easyesg.md' })),
      ).rejects.toBeInstanceOf(AdminCredentialInvalidError);

      // The table is append-only and retained 24 months (§12.5.7), so anything written here cannot
      // be taken back. Asserted on the recorded event rather than trusted to the hashing helper.
      expect(JSON.stringify(audit.recorded)).not.toContain('nobody@easyesg.md');
    });

    it('records a locked account before verifying anything', async () => {
      const store = new FakeAdminSessionStore();
      store.accounts.push(operator({ lockedAt: NOW }));
      const audit = new FakeSystemAuditLog();

      await expect(build(store, audit).execute(command())).rejects.toBeInstanceOf(
        AdminAccountLockedError,
      );

      expect(audit.actions).toEqual([AUDIT_ACTION.ADMIN_SIGN_IN_BLOCKED]);
    });

    /**
     * **A correct credential records nothing here**, because a sign-in is the pair: FR-75 makes the
     * factor mandatory, so a password alone admits nobody and a row saying otherwise would
     * overstate what happened. `CompleteAdminSignIn` owns the success event.
     */
    it('records nothing when the credential is correct — the sign-in has not happened yet', async () => {
      const store = new FakeAdminSessionStore();
      store.accounts.push(operator());
      const audit = new FakeSystemAuditLog();

      await build(store, audit).execute(command());

      expect(audit.recorded).toEqual([]);
    });
  });
});
