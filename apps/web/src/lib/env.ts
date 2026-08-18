import 'server-only';

/**
 * Typed environment access, resolved once at module load.
 *
 * `apps/api`'s rule is "business logic reads ConfigService, never `process.env`" (CLAUDE.md).
 * This is that rule for the web tier: `process.env` appears in this file and nowhere else, so a
 * missing variable fails at startup naming itself rather than surfacing at request time as an
 * `undefined` interpolated into a URL.
 *
 * `server-only` makes importing this from a Client Component a **build** error, not a lint
 * error — `SESSION_SECRET` must never reach a browser bundle.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See apps/web/.env.example.`);
  }
  return value;
}

/**
 * Getters, not values. Resolving eagerly would make importing this module — which anything
 * reaching the API does transitively — fail a build that never actually needs a secret.
 * `SESSION_SECRET` in particular is a runtime input and not a build input.
 */
export const env = {
  /** The public API. AD-9: this app is an ordinary client of it, never a privileged route. */
  get apiBaseUrl(): string {
    return required('API_BASE_URL');
  },

  /**
   * Mirrors apps/api. Default-on: an unset flag must not silently disable a paid surface.
   * With it off, the commerce subtree renders its unavailable state and UC-17…48 still pass (A6).
   */
  get billingEnabled(): boolean {
    return process.env.BILLING_ENABLED !== 'false';
  },

  get sessionSecret(): string {
    return required('SESSION_SECRET');
  },
} as const;
