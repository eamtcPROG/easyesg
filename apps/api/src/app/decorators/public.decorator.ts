import { SetMetadata } from '@nestjs/common';

/** Read by `AuthGuard`. Here rather than beside the guard because `app/` may not import `modules/`. */
export const IS_PUBLIC = 'easyesg:public';

/**
 * Marks a route reachable without a tenant session — the exception to the closed-by-default rule
 * `AuthGuard` establishes (task 28.1).
 *
 * **Every use of this is a decision, so each carries its reason at the route.** There are three
 * kinds and no fourth:
 *
 *  - **The routes that make a session exist.** Register, verify, sign in, refresh, reset, the
 *    social exchange. Requiring a token to obtain a token is the obvious circularity, and sign-out
 *    is here too because AD-12 has it authenticate by refresh token — deliberately, so it still
 *    works in UC-07's state, with the access token already expired.
 *  - **Liveness.** `/health` must not depend on the database being reachable, or a probe reports
 *    the wrong thing and a container gets killed for a slow query.
 *  - **The admin realm**, and this one reads alarmingly, so it says so where it is applied:
 *    `/auth/admin/*` is public to the **tenant** guard and not public at all. It carries no bearer
 *    — NFR-65 gives it a separate credential store and a sealed `SameSite=Strict` cookie which its
 *    own handler verifies, and `AdminRealmGuard` is what will make that a chain rather than a
 *    controller's own checking — **task 67.3**, assigned 27 Aug 2026 when task 28.2 found the guard
 *    had no owner: it protects nothing until A-02 gives it a route beyond this handshake. Marking it here is what stops the tenant guard 401-ing the
 *    more privileged surface for not carrying the less privileged surface's token.
 *
 * Swagger's `/docs` needs no marker: `SwaggerModule.setup` mounts express middleware rather than a
 * Nest route, so no `APP_GUARD` ever runs for it.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
