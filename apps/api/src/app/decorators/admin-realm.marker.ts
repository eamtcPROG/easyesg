/**
 * Read by `AuthGuard`, set by `platform/admin`'s `@RequiresAdminRole` (task 67.3). Here rather than
 * beside either, for `public.decorator.ts`'s reason: `app/` may not import `modules/`, and the tenant
 * guard in `identity/session` must not import `platform/admin` to learn which routes are not its own.
 *
 * **It marks a route as the admin realm's, which is not the same as public.** An admin-realm route
 * carries no bearer — NFR-65 gives the realm its own credential store and a sealed cookie — so the
 * tenant `AuthGuard` has nothing to judge and stands aside, while `AdminRealmGuard`, applied by the
 * same decorator that sets this, is what refuses. A route carrying this marker without that guard
 * would be open, which is why nothing but `@RequiresAdminRole` sets it.
 */
export const IS_ADMIN_REALM = 'easyesg:admin-realm';
