import { parseArgs } from 'node:util';
import { DataSource } from 'typeorm';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import {
  mintTotpSecret,
  totpEnrolmentUri,
} from '@api/modules/platform/admin/domain/totp';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { ADMIN_ROLE } from '@api/modules/platform/admin/models/admin-session.model';

/**
 * Entrypoint for `pnpm --filter @easyesg/api admin:provision` — UC-68's precondition,
 * mechanised: "an elevated administrator account exists (UC-87) with MFA enrolled". UC-87's
 * screens are task 67; until then THIS is how an operator account comes to exist, and it is
 * also §12.5.6's named lockout release for the realm (`--unlock`).
 *
 * Runs from `dist/` under plain `node` (see `admin:provision` in package.json): `tsc-alias` has
 * already resolved the `@api/*` imports there, which is what lets this entrypoint reuse the
 * REAL Argon2id adapter and TOTP domain rather than restating §9.1's parameters — the exact
 * drift a hand-rolled hash call here would invite. Connects as `esg_app` like the config
 * seeder: provisioning is an ordinary application write (task 67 does the same through the
 * API), and the migration owner's credentials are unavailable to runtime processes by design.
 *
 * The TOTP secret prints as an otpauth:// URI for the operator's authenticator; `--totp-secret`
 * exists so a rehearsal or e2e can pin a known one. The password travels as an argument, which
 * is fine for the synthetic dev/staging credentials this serves before task 67 — a production
 * operator rotates it at first PA-managed opportunity.
 *
 * Since task 27.1 the secret is **sealed before it is written**, with the same adapter the api
 * reads it back through. That is not politeness toward the column's type: `identity.admin_account
 * .totp_secret` is `identity.encrypted_secret`, so an INSERT of plaintext is refused by the
 * database. The URI still prints the plaintext, because an authenticator app is what it is for
 * and it exists only in this process's memory and the operator's terminal.
 */
const USAGE =
  'admin:provision --email <address> --password <password> [--role platform_administrator|billing_operator] ' +
  '[--totp-secret <base32>] [--unlock]';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', default: ADMIN_ROLE.PLATFORM_ADMINISTRATOR },
      'totp-secret': { type: 'string' },
      unlock: { type: 'boolean', default: false },
    },
  });

  if (!values.email) throw new Error(`--email is required.\n${USAGE}`);
  const email = normaliseEmail(values.email);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'postgres',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: process.env.DB_USER ?? 'esg_app',
    password: process.env.DB_PASSWORD ?? '',
    synchronize: false,
    entities: [],
    applicationName: 'easyesg-admin-provision',
  });

  await dataSource.initialize();
  try {
    if (values.unlock) {
      const result: unknown = await dataSource.query(
        `UPDATE identity.admin_account
            SET locked_at = NULL, failed_attempts = 0, updated_at = now()
          WHERE email = $1
          RETURNING email`,
        [email],
      );
      // UPDATE … RETURNING arrives as [rows, count] (the store's returnedRows note).
      const unlocked =
        Array.isArray(result) && Array.isArray(result[0]) && result[0].length > 0;
      process.stdout.write(
        unlocked ? `${email}: unlocked\n` : `${email}: no such operator account\n`,
      );
      return;
    }

    if (!values.password) throw new Error(`--password is required.\n${USAGE}`);
    const role = values.role;
    if (!(Object.values(ADMIN_ROLE) as string[]).includes(role)) {
      throw new Error(`--role must be one of ${Object.values(ADMIN_ROLE).join(', ')}.\n${USAGE}`);
    }

    const hasher = new Argon2PasswordHasher(process.env.AUTH_PASSWORD_PEPPER);
    const passwordHash = await hasher.hash(values.password);
    const totpSecret = values['totp-secret'] ?? mintTotpSecret();
    const secrets = new AesGcmSecretCipher(process.env.SECRET_ENCRYPTION_KEY);

    await dataSource.query(
      `INSERT INTO identity.admin_account (email, role, password_hash, totp_secret)
       VALUES ($1, $2, $3, $4)`,
      [email, role, passwordHash, secrets.seal(totpSecret)],
    );

    process.stdout.write(`${email}: provisioned as ${role}\n`);
    process.stdout.write(`Enrol the second factor from this URI (FR-75):\n`);
    process.stdout.write(`${totpEnrolmentUri({ email, secret: totpSecret })}\n`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
