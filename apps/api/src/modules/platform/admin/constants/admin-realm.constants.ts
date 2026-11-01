/**
 * `@RequiresAdminRole`'s metadata key (task 67.3) — read by `AdminRealmGuard` to compare the
 * operator's role, and by `src/testing/route-permissions.ts` to publish the route's permission.
 */
export const REQUIRED_ADMIN_ROLES = 'easyesg:required-admin-roles';
