/**
 * Typed access to the build-time environment.
 *
 * Vite inlines every `VITE_*` variable into the shipped bundle at build time. Two consequences
 * that are easy to learn the expensive way:
 *
 *   1. No secret may ever be read through here. The bundle is a public artefact the moment it
 *      is built; the IP allowlist in front of `admin.<host>` (§10.2) restricts who can fetch
 *      it, not what it contains. NFR-69 governs secrets, and none of them are build inputs.
 *   2. The API base URL being a build input means one artefact per environment — a bundle
 *      built against staging cannot be promoted to production. Logged in architecture.md §18.
 *
 * The fallback targets the dev stack's api port, the same convention the api itself uses for
 * `web.publicUrl` and `admin.origin`: an origin is not a secret, and a host run should work
 * with no env file. Like `apps/web`'s `API_BASE_URL`, the value carries the `/api/v1` prefix,
 * so client paths are version-relative.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
} as const;
