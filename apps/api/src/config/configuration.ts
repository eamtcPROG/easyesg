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
  billingEnabled: process.env.BILLING_ENABLED !== 'false',
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
  },
  email: { provider: process.env.EMAIL_PROVIDER },
  // 3100 is `apps/web`'s dev port (`next dev --port 3100`), so a host run works with no .env entry.
  web: { publicUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3100' },
});
