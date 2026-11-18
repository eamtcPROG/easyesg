/**
 * `@RequiresAdminRole`'s metadata key (task 67.3) — read by `AdminRealmGuard` to compare the
 * operator's role, and by `src/testing/route-permissions.ts` to publish the route's permission.
 */
export const REQUIRED_ADMIN_ROLES = 'easyesg:required-admin-roles';

/**
 * `@RequiresAdminPermission`'s metadata key (task 67.13) — read by `AdminRealmGuard` against the operator's roles, and
 * by `src/testing/route-permissions.ts` to publish the route's permission beside its realm.
 */
export const REQUIRED_ADMIN_PERMISSION = 'easyesg:required-admin-permission';
