import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_SESSION_COOKIE,
} from '@api/modules/platform/admin/constants/admin-session.constants';
import { totpCodeAt } from '@api/modules/platform/admin/domain/totp';
import type { AdminRole } from '@api/modules/platform/admin/models/admin-session.model';
import { required } from './database';

/**
 * A real signed-in operator, obtained the way an operator obtains one (task 67.3) — the admin realm's
 * `signInFreshAccount`, for the suites that reach an admin-realm route rather than test the handshake.
 *
 * **Provisioned as `esg_app`, the role the `admin:provision` CLI runs as**, with the TOTP secret sealed
 * on the way in — the database refuses plaintext (task 27.1). **Signed in through the real two-step
 * handshake**, credential then factor, against a pinned secret, because the server's clock is real.
 * `admin-session.e2e-spec.ts` keeps its own copies of these steps: the handshake is its subject, and a
 * helper hiding it would hide what that suite asserts.
 */
export const OPERATOR_PASSWORD = 'Parola123!';

const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

/** The console origin the api's Origin proof admits on the handshake's two POSTs. */
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3200';

/** Every address this module provisioned in this test file — per-file, as jest's registries are. */
const provisioned = new Set<string>();

export interface SignedInOperator {
  readonly accountId: string;
  readonly email: string;
  readonly role: AdminRole;
  /** The sealed session cookie's value — set as `easyesg_admin_session=<value>`. */
  readonly sealedSession: string;
  /** `{ cookie: … }`, ready to spread into a supertest `.set`. */
  readonly cookie: { cookie: string };
}

const cookieValue = (response: request.Response, name: string): string => {
  const header = ([] as string[]).concat(response.headers['set-cookie'] as unknown as string[]).join('\n');
  const match = new RegExp(`${name}=([^;]*)`, 'u').exec(header);
  if (!match?.[1]) throw new Error(`no ${name} cookie on the response`);
  return match[1];
};

export const signInOperator = async (input: {
  readonly server: Parameters<typeof request>[0];
  /** `esg_app` — the grants the provisioning CLI holds. */
  readonly application: DataSource;
  readonly email: string;
  readonly role: AdminRole;
}): Promise<SignedInOperator> => {
  const hasher = new Argon2PasswordHasher(required('AUTH_PASSWORD_PEPPER'));
  const secrets = new AesGcmSecretCipher(required('SECRET_ENCRYPTION_KEY'));

  const [row] = await input.application.query<{ id: string }[]>(
    `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.email, input.role, await hasher.hash(OPERATOR_PASSWORD), secrets.seal(TOTP_SECRET)],
  );
  provisioned.add(input.email);

  const opened = await request(input.server)
    .post('/api/v1/auth/admin/session/challenge')
    .set('origin', ADMIN_ORIGIN)
    .send({ email: input.email, password: OPERATOR_PASSWORD })
    .expect(201);

  const code = totpCodeAt(TOTP_SECRET, new Date());
  if (code === null) throw new Error('the pinned TOTP secret failed to decode');

  const signedIn = await request(input.server)
    .post('/api/v1/auth/admin/session')
    .set('origin', ADMIN_ORIGIN)
    .set('cookie', `${ADMIN_CHALLENGE_COOKIE}=${cookieValue(opened, ADMIN_CHALLENGE_COOKIE)}`)
    .send({ totpCode: code })
    .expect(201);

  const sealedSession = cookieValue(signedIn, ADMIN_SESSION_COOKIE);
  return {
    accountId: row.id,
    email: input.email,
    role: input.role,
    sealedSession,
    cookie: { cookie: `${ADMIN_SESSION_COOKIE}=${sealedSession}` },
  };
};

/**
 * Removes what this file provisioned, as the migration owner — `esg_app` holds no DELETE on the
 * realm's tables (task 23's migration). Sessions and refresh tokens cascade from the account. The
 * system audit and support access logs keep their rows: both are append-only, and that is the
 * guarantee rather than a leak.
 */
export const cleanupSignedInOperators = async (input: { readonly owner: DataSource }): Promise<void> => {
  const emails = [...provisioned];
  if (emails.length === 0) return;
  await input.owner.query(`DELETE FROM identity.admin_account WHERE email = ANY($1)`, [emails]);
  // Task 67.4: an invitation these operators sent, or one addressed to them, goes with them.
  await input.owner.query(`DELETE FROM identity.admin_invitation WHERE email = ANY($1)`, [emails]);
  await input.owner.query(
    `DELETE FROM identity.auth_attempt WHERE ${emails.map((_, i) => `attempt_key LIKE $${i + 1}`).join(' OR ')}`,
    emails.map((email) => `%${email}%`),
  );
  provisioned.clear();
};
