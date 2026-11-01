import 'server-only';

/**
 * How a boolean is spelled in an environment variable, named rather than compared as a bare
 * literal (CLAUDE.md, "Conventions"). The opt-out is the exact string, so an unset, misspelled
 * or empty value leaves the flag ON — the safe direction, and a stated rule rather than an
 * artefact of `!==`. `apps/api/src/config/configuration.ts` carries the same constant for the
 * same variable: two runtimes reading one deployment's environment, not a shared module (AD-9).
 */
const ENV_FALSE = 'false';

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
    return process.env.BILLING_ENABLED !== ENV_FALSE;
  },

  get sessionSecret(): string {
    return required('SESSION_SECRET');
  },

  /**
   * This app's own public origin, for the OAuth redirect URIs task 24 registers at the
   * providers (`{origin}/auth/social/{provider}/callback`). An env value with the dev default —
   * `next dev --port 3100` — rather than the request's Host header: the api refuses a redirect
   * URI outside its configured allowlist either way, but a URI built from Host would make the
   * one the provider sees attacker-influenced, which is the classic redirect-poisoning shape.
   * Mirrors the api's `PUBLIC_WEB_URL` (same variable name, two runtimes — AD-9).
   */
  get publicOrigin(): string {
    return process.env.PUBLIC_WEB_URL ?? 'http://localhost:3100';
  },

  /**
   * The api's public origin, as a **browser** reaches it — where AD-15's socket is opened (task 149; §12.5.6's
   * task-149 row (2)). Not `apiBaseUrl`, which inside Compose and behind the edge is an internal address. Read at
   * request time and handed to the client by the `(app)` layout, so no build inlines it. **Unset, the accelerator is
   * off**: no socket opens and every surface runs on its poll, which is the floor — the safe direction. Set to
   * something that is not a URL, it fails naming itself rather than as a socket that never opens.
   */
  get publicApiOrigin(): string | null {
    const value = process.env.PUBLIC_API_URL;
    if (!value) return null;
    if (!URL.canParse(value)) {
      throw new Error(`PUBLIC_API_URL is not a URL: ${value}. See apps/web/.env.example.`);
    }
    return new URL(value).origin;
  },
} as const;
