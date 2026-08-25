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

export interface SignedInAccount {
  readonly accountId: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  /** `Authorization: Bearer …`, ready to spread into a supertest call. */
  readonly authorization: { Authorization: string };
}

export const signInFreshAccount = async (input: {
  /** `app.getHttpServer()` — typed loosely because supertest accepts what Nest returns. */
  readonly server: Parameters<typeof request>[0];
  /** A connection as `esg_worker`; `esg_app` holds INSERT on the outbox and not SELECT. */
  readonly worker: DataSource;
  readonly email: string;
}): Promise<SignedInAccount> => {
  const http = () => request(input.server);

  const registered = await http()
    .post('/api/v1/auth/register')
    .send({ email: input.email, password: PASSWORD })
    .expect(201);

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
    accountId: (registered.body as { object: { id: string } }).object.id,
    email: input.email,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    authorization: { Authorization: `Bearer ${issued.accessToken}` },
  };
};
