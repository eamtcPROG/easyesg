/**
 * Environment shape, validated once at boot.
 *
 * Business logic reads ConfigService, never process.env (CLAUDE.md). Validation happens
 * before the connection pool opens, so a missing variable is a startup failure with a
 * name in it rather than a null dereference three layers down at 09:00 in filing season.
 */
/**
 * The two entrypoint roles of AD-1's single image (§5.4), as values rather than literals.
 *
 * The comparison `MODE === 'worker'` splits provider sets in five files, and a typo'd literal
 * does not error — the comparison is simply false and the wrong branch registers silently, which
 * presents as a worker that consumes nothing or an api that starts polling. A constant makes the
 * typo a compile failure instead. House rule (apps/api/CLAUDE.md): a literal compared at more
 * than one site is a constant.
 */
export const APP_MODE = {
  HTTP: 'http',
  WORKER: 'worker',
} as const;

/**
 * How a boolean is spelled in an environment variable. Named rather than compared as a bare
 * `'false'` (CLAUDE.md, "Conventions"): the opt-out is deliberately the exact string, so that
 * an unset, misspelled or empty `BILLING_ENABLED` leaves billing ON — the safe direction — and
 * naming it is what makes that a stated rule instead of an artefact of `!==`.
 * `apps/web/src/lib/env.ts` carries the same constant for the same variable; they are two
 * runtimes reading one deployment's environment, not a shared module (AD-9).
 */
const ENV_FALSE = 'false';

/**
 * The opt-IN spelling, for flags whose safe direction is OFF: `AUTH_SOCIAL_ALLOW_INSECURE`
 * weakens a security posture (http issuers, for the e2e stub), so an unset, misspelled or empty
 * value must leave TLS required — the mirror of `ENV_FALSE`'s argument, with the sign flipped.
 */
const ENV_TRUE = 'true';

export type AppMode = (typeof APP_MODE)[keyof typeof APP_MODE];

export interface AppConfig {
  mode: AppMode;
  port: number;
  /** DR-1 / NFR-1: with this false, UC-17…48 must still pass. */
  billingEnabled: boolean;
  database: {
    host: string;
    port: number;
    name: string;
    /** Non-superuser, non-owner, RLS NOT bypassable (AD-2). */
    user: string;
    password: string;
  };
  redis: { host: string; port: number };
  auth: {
    /**
     * §9.1: "Argon2id, per-user salt, pepper from secret manager". The salt is Argon2's own; this
     * is the pepper, and it is deliberately NOT defaulted — a hash computed without it is not the
     * hash §9.1 specifies, and a default would make that indistinguishable from a correct one. It
     * is read here and validated where it is used, so `openapi:check` keeps booting the module
     * graph with no secrets (emit-openapi.ts runs in `preview` mode and instantiates nothing).
     */
    passwordPepper: string | undefined;
    /**
     * AD-12's access-token signing secret (task 21). HTTP tier only, like the pepper, and NOT
     * defaulted for the pepper's reason: a token signed with a default is indistinguishable from
     * a correct one until verification meets it. Rotating it invalidates every outstanding access
     * token — a ≤15-minute blip by design — and no refresh token, which is a database row.
     */
    jwtSecret: string | undefined;
    /**
     * The admin realm's one secret (task 23, §12.5.6): the JWT signing key and the cookie
     * sealing key are both HKDF-derived from it under distinct labels, so one rotation retires
     * both. Deliberately NOT `jwtSecret` — NFR-65's "no shared credential" includes the signing
     * key, and cryptographic disjointness is what makes a tenant access token structurally
     * unable to pass for an admin one. HTTP tier only, undefaulted, for the pepper's reason.
     */
    adminSecret: string | undefined;
    /**
     * Social sign-in's environment half (task 24, §12.5.6's task-24 configuration row): the
     * per-provider client secrets — everything else about a provider is configuration-store
     * data. Undefaulted but, unlike the pepper, NOT boot-fatal: a missing secret makes ONE
     * provider unavailable (logged at error where it is resolved), because taking the tier down
     * over one provider would be the outage FR-82 exists to prevent. Moves to OpenBao when it
     * exists; until then rotation is an environment change, the recorded FR-82 deferral.
     */
    social: {
      /** Permits `http://` issuers — the e2e stub provider. Never set in production. */
      allowInsecureIssuers: boolean;
      google: { clientSecret: string | undefined };
      microsoft: { clientSecret: string | undefined };
    };
  };
  admin: {
    /**
     * The console's exact origin — what CORS allows with credentials and what the Origin proof
     * on state-changing admin-realm requests compares against (§12.5.6, task 23). Not a secret;
     * defaulted to the dev port the way `web.publicUrl` is.
     */
    origin: string;
  };
  email: {
    /**
     * Which `EmailPort` adapter to register. **No default, on purpose.** `log` is a development
     * stand-in that writes the rendered message to the application log, which NFR-30 forbids of a
     * production logging pipeline — so the choice is made per environment or the process does not
     * start. Mailjet (OQ-12) is registered here by task 51.
     */
    provider: string | undefined;
  };
  web: {
    /**
     * Origin of `apps/web`, used to build the verification link the email carries (FR-3). The API
     * owns the link because the worker composing the mail has no request to derive an origin from,
     * and a link built from a request `Host` header is a well-known redirect-poisoning path.
     */
    publicUrl: string;
  };
}

export default (): AppConfig => ({
  mode: process.env.MODE === APP_MODE.WORKER ? APP_MODE.WORKER : APP_MODE.HTTP,
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  billingEnabled: process.env.BILLING_ENABLED !== ENV_FALSE,
  database: {
    host: process.env.DB_HOST ?? 'postgres',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'esg',
    // §7.6 gives the worker its own role, and it is not a formality: `esg_worker` may read and
    // mark the outbox, which `esg_app` may only write to. Running the worker as `esg_app` fails
    // on the dispatcher's first poll — loudly, which is the good outcome, but only after deploy.
    //
    // In production each container supplies its own DB_USER, so the fallback is what applies and
    // no worker credential sits in the api's environment. The DB_WORKER_* pair exists so one local
    // .env can serve both modes without editing it between runs.
    ...(process.env.MODE === APP_MODE.WORKER && process.env.DB_WORKER_USER
      ? {
          user: process.env.DB_WORKER_USER,
          password: process.env.DB_WORKER_PASSWORD ?? '',
        }
      : {
          user: process.env.DB_USER ?? 'esg_app',
          password: process.env.DB_PASSWORD ?? '',
        }),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  auth: {
    passwordPepper: process.env.AUTH_PASSWORD_PEPPER,
    jwtSecret: process.env.AUTH_JWT_SECRET,
    adminSecret: process.env.AUTH_ADMIN_SECRET,
    social: {
      allowInsecureIssuers: process.env.AUTH_SOCIAL_ALLOW_INSECURE === ENV_TRUE,
      google: { clientSecret: process.env.AUTH_SOCIAL_GOOGLE_CLIENT_SECRET },
      microsoft: { clientSecret: process.env.AUTH_SOCIAL_MICROSOFT_CLIENT_SECRET },
    },
  },
  // 3200 is `apps/admin`'s dev port, so a host run works with no .env entry (same convention
  // as `web.publicUrl` below).
  admin: { origin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3200' },
  email: { provider: process.env.EMAIL_PROVIDER },
  // 3100 is `apps/web`'s dev port (`next dev --port 3100`), so a host run works with no .env entry.
  web: { publicUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3100' },
});
