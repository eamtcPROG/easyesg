/**
 * Environment shape, validated once at boot.
 *
 * Business logic reads ConfigService, never process.env (CLAUDE.md). Validation happens
 * before the connection pool opens, so a missing variable is a startup failure with a
 * name in it rather than a null dereference three layers down at 09:00 in filing season.
 */
export interface AppConfig {
  mode: 'http' | 'worker';
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
}

export default (): AppConfig => ({
  mode: process.env.MODE === 'worker' ? 'worker' : 'http',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  billingEnabled: process.env.BILLING_ENABLED !== 'false',
  database: {
    host: process.env.DB_HOST ?? 'postgres',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'esg',
    user: process.env.DB_USER ?? 'esg_app',
    password: process.env.DB_PASSWORD ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
});
