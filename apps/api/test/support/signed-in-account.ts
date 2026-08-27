import request from 'supertest';
import type { DataSource } from 'typeorm';
import { EMAIL_VERIFICATION_REQUESTED } from '@api/modules/identity/account/constants/account.constants';

/**
 * A real signed-in account, obtained the way a person obtains one — **the replacement for task 11's
 * request-identity fixture**, which task 28.1 deleted rather than disabled.
 *
 * The fixture wrote `actorId`, `organizationId` and `role` straight into the request context because
 * nothing resolved them. `AuthGuard` now does, so a test that kept the fixture would be asserting
 * against a state the guard never produces — and the two could disagree without a single failure.
 * The suites therefore attach a bearer token, exactly as `apps/web` does.
 *
 * **It costs an Argon2 hash per account, and that is the price of the fidelity.** The hash is
 * deliberately expensive (§9.1), so a suite driving five actors pays five of them. Seeding rows and
 * minting a token would be faster and would exercise none of the path this proves: registration,
 * verification through the outbox, sign-in, and the guard's own lookup.
 *
 * The verification token is read from `audit.outbox_event` because that is the one durable place
 * the raw value exists (OQ-54) — `identity.verification_token` holds only its SHA-256. The read
 * needs a role that may SELECT the outbox, which `esg_app` deliberately may not: the worker
 * connection is the one to pass here.
 */
export const PASSWORD = 'Str0ng-Passphrase!';

/**
 * Every address this module has registered in THIS test file.
 *
 * Module-level and mutable, which is normally a smell and is right here: jest gives each test file
 * its own module registry, so this set is per-suite by construction — it records exactly what this
 * suite created and nothing another suite did. It is what lets `cleanupSignedInAccounts` take no
 * email list, so a suite cannot pass the wrong one or forget an actor it added later.
 */
const registered = new Set<string>();

export interface SignedInAccount {
  readonly accountId: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  /** `Authorization: Bearer …`, ready to spread into a supertest call. */
  readonly authorization: { Authorization: string };
}

/**
 * Register an account and nothing more — the half of `signInFreshAccount` a suite sometimes needs
 * alone, and the reason this is exported rather than inlined at the call site.
 *
 * `invitations.e2e-spec.ts` registers an invitee with `Accept-Language: ru` to prove the invitation
 * email takes the *invitee's* locale; it needs no session, so it was calling `POST /auth/register`
 * directly — and its outbox row was therefore outside the set below, which is how one stray row
 * survived after seven suites had been fixed. Registration is what emits the row, so registration is
 * what has to record it: any test registering an account should come through here.
 */
export const registerFreshAccount = async (input: {
  readonly server: Parameters<typeof request>[0];
  readonly email: string;
  /** Negotiated into `account.locale` (OQ-46), which some suites are specifically asserting. */
  readonly acceptLanguage?: string;
}): Promise<{ accountId: string }> => {
  const call = request(input.server).post('/api/v1/auth/register');
  if (input.acceptLanguage !== undefined) call.set('Accept-Language', input.acceptLanguage);

  const created = await call.send({ email: input.email, password: PASSWORD }).expect(201);
  registered.add(input.email);
  return { accountId: (created.body as { object: { id: string } }).object.id };
};

export const signInFreshAccount = async (input: {
  /** `app.getHttpServer()` — typed loosely because supertest accepts what Nest returns. */
  readonly server: Parameters<typeof request>[0];
  /** A connection as `esg_worker`; `esg_app` holds INSERT on the outbox and not SELECT. */
  readonly worker: DataSource;
  readonly email: string;
}): Promise<SignedInAccount> => {
  const http = () => request(input.server);

  const { accountId } = await registerFreshAccount({ server: input.server, email: input.email });

  const queued = await input.worker.query<{ payload: { token: string } }[]>(
    `SELECT payload FROM audit.outbox_event
      WHERE event_type = $1 AND payload->>'email' = $2
      ORDER BY occurred_at DESC`,
    [EMAIL_VERIFICATION_REQUESTED, input.email],
  );
  await http()
    .post('/api/v1/auth/verify-email')
    .send({ token: queued[0].payload.token })
    .expect(200);

  const session = await http()
    .post('/api/v1/auth/session')
    .send({ email: input.email, password: PASSWORD })
    .expect(201);

  const issued = (session.body as { object: { accessToken: string; refreshToken: string } }).object;
  return {
    accountId,
    email: input.email,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    authorization: { Authorization: `Bearer ${issued.accessToken}` },
  };
};

/**
 * The rows this helper leaves behind, removed by the suite that asked for them (27 Aug 2026).
 *
 * **Registering an account emits an `identity.email_verification.requested` outbox row**, and
 * deleting the account does not take it: `audit.outbox_event` carries no foreign key to
 * `identity.account` on purpose — an effect must outlive the state change that caused it, which is
 * the whole of AD-6. So every suite that signs an actor in was leaking one undispatched row per
 * actor, and seven of them never cleaned it.
 *
 * **Nobody noticed because `outbox.e2e-spec.ts` was wiping the table unscoped**, which under
 * `--runInBand` meant it silently cleaned up after every suite that had run before it. Scoping that
 * DELETE to its own organization is what surfaced this: four suites run alphabetically ahead of it,
 * and their twenty stray rows made `dispatchBatch()` return 21 where the test expects 1.
 *
 * Owned here rather than copied into seven `afterAll`s, because the helper is what creates the row —
 * the missing export from the module that owns the operation, exactly as CLAUDE.md frames it. It
 * takes the **worker** connection for the same reason the read above does: `esg_app` may INSERT into
 * the outbox and not SELECT it, and the owner is the only role that may DELETE.
 */
export const cleanupSignedInAccounts = async (input: {
  /** A connection as `esg_migrator` — the only role holding DELETE on `audit.outbox_event`. */
  readonly owner: DataSource;
}): Promise<void> => {
  if (registered.size === 0) return;
  await input.owner.query(
    `DELETE FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' = ANY($2)`,
    [EMAIL_VERIFICATION_REQUESTED, [...registered]],
  );
  registered.clear();
};

