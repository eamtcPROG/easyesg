/**
 * Typed access to the build-time environment.
 *
 * NOT BUILT — a docblock over an empty export.
 *
 * Vite inlines every `VITE_*` variable into the shipped bundle at build time. Two consequences
 * that are easy to learn the expensive way:
 *
 *   1. No secret may ever be read through here. The bundle is a public artefact the moment it is
 *      built; the IP allowlist in front of `admin.<host>` (§10.2) restricts who can fetch it, not
 *      what it contains. NFR-69 governs secrets, and none of them are build inputs.
 *   2. The API base URL being a build input means one artefact per environment — a bundle built
 *      against staging cannot be promoted to production. §10.4 implies this by serving a static
 *      bundle from `edge`, but no document states it. Logged in architecture.md §18.
 *
 * This is the opposite of apps/web's `src/lib/env.ts`, which resolves through getters so a secret
 * stays a runtime input. That option does not exist here, which is the point of writing it down.
 */
export {};
