import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { IS_ADMIN_REALM } from '@api/app/decorators/admin-realm.marker';
import { REQUIRED_ADMIN_ROLES } from '../constants/admin-realm.constants';
import { AdminRealmGuard } from '../guards/admin-realm.guard';
import type { AdminRole } from '../models/admin-session.model';

/**
 * Declares an admin-realm route and which operators reach it (task 67.3; FR-75, FR-76, NFR-65).
 *
 * **Three things in one decorator, and none of them may be applied alone** — `@RequiresRole`'s shape
 * (task 25.2) for its reason, with one more part. The `IS_ADMIN_REALM` marker tells the tenant
 * `AuthGuard` the route is not its to judge; the roles are what `AdminRealmGuard` compares; and the
 * guard is what refuses. The marker without the guard would open the route to everyone, which is
 * why the marker is never exported for use on its own.
 *
 * An empty role list refuses every operator rather than admitting any — the guard's `includes` over
 * nothing is false — so a route that forgot its roles is closed.
 *
 *     @RequiresAdminRole(ADMIN_ROLE.PLATFORM_ADMINISTRATOR)
 *     export class OrganizationRegisterController { ... }
 */
export const RequiresAdminRole = (...roles: AdminRole[]) =>
  applyDecorators(
    SetMetadata(IS_ADMIN_REALM, true),
    SetMetadata(REQUIRED_ADMIN_ROLES, roles),
    UseGuards(AdminRealmGuard),
  );
