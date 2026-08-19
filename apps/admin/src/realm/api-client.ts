/**
 * The console's client for the one public API.
 *
 * NOT BUILT — a docblock over an empty export.
 *
 * DR-11 and P-5: `web` and `admin` are ordinary clients of one documented, versioned surface,
 * authorized identically. There is no privileged route, no direct database path and no back door.
 * Admin's routes are `/api/v1/admin/*` (§6.8) — ordinary, OpenAPI-declared, contract-tested, and
 * authorized by the acting principal's privilege level (FR-80), which is a server-side decision
 * on every request (FR-158, NFR-62). Hiding a control in this app is not authorization.
 *
 * Types come from `@easyesg/contracts`, which is generated from `apps/api` and diffed in CI. This
 * app must never reach into `apps/api/src` for a type — `admin-not-to-api-src` fails the build if
 * it does.
 *
 * Two wire conventions that shape every call site:
 *   · Success is enveloped (`ResultObjectDto` / `ResultListDto`), errors are not — failures
 *     arrive as RFC 9457 `application/problem+json`.
 *   · Lists use the compact format: `?filters=f,v1,v2|f2,v3&order=f,asc&page=1&onpage=25`, and
 *     admin's ceiling is 200 rows (`MAX_ON_PAGE_ADMIN`), not the tenant 100. `onpage=-1` is
 *     rejected on anything append-only — the audit log, the billing ledger and metering are
 *     unbounded by construction and retain for six years.
 *
 * Requests are cross-origin by design (admin.<host> → api.<host>), which is why vite.config.ts
 * declines to proxy them away in development. Credential mode and CSRF posture are OQ-33.
 */
export {};
