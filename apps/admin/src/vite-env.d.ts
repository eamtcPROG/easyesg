/**
 * The console's `VITE_*` surface, typed. Vite's own `ImportMetaEnv` indexes unknown keys as
 * `any`, so an undeclared variable reads cleanly and fails nowhere — declaring each one here is
 * what makes `src/lib/env.ts` type-checked and a typo'd name a compile error.
 */
interface ImportMetaEnv {
  /** The public API's base URL, `/api/v1` prefix included. A BUILD input — see lib/env.ts. */
  readonly VITE_API_BASE_URL?: string;
}
