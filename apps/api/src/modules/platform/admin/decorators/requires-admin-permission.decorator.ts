import { SetMetadata } from '@nestjs/common';
import { REQUIRED_ADMIN_PERMISSION } from '../constants/admin-realm.constants';
import type { AdminPermission } from '../models/console-role.model';

/**
 * The permission a Platform Administrator's route needs (task 67.13; FR-80 behaviour 10; 182/3) — beside the class's
 * `@RequiresAdminRole`, which applies the guard that reads it. **Every route that admits only Platform Administrators
 * declares one**, and `route-permissions.spec.ts` fails one that does not, as it fails an admin write with no audit
 * action; a route every operator reaches — their own credentials — declares none, since it guards nothing the realm
 * does not.
 *
 *     @Get()
 *     @RequiresAdminPermission(ADMIN_PERMISSION.ORGANIZATIONS_READ)
 */
export const RequiresAdminPermission = (permission: AdminPermission) =>
  SetMetadata(REQUIRED_ADMIN_PERMISSION, permission);
