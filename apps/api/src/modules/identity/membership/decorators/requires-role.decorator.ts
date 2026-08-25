import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import type { MembershipRole } from '../models/membership.model';
import { RequiresRoleGuard } from '../guards/requires-role.guard';
import { REQUIRED_ROLES } from '../constants/membership.constants';

/**
 * Declares which organization roles may reach a route or a controller (FR-158, NFR-62).
 *
 * **It applies the guard as well as the metadata, and that is the whole design.** The usual shape
 * — `@UseGuards(SomeGuard)` in one place, `@SomeMetadata()` in another — has a failure mode with no
 * symptom: a route that carries the metadata and not the guard is **open**, and looks gated in
 * review. Composing them means the gate cannot be half-applied. The residual risk is a route that
 * declares neither, which no mechanism inside a decorator can catch; task 28's guard chain is where
 * "authenticated by default" becomes a whole-surface property.
 *
 * `@UseGuards` is idempotent when the decorator is applied at both class and method level, and
 * `getAllAndOverride` makes the method's list win — so a controller may state its baseline and one
 * route may narrow or widen it.
 *
 *     @RequiresRole(MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR)
 *     export class MembersController { ... }
 */
export const RequiresRole = (...roles: MembershipRole[]) =>
  applyDecorators(SetMetadata(REQUIRED_ROLES, roles), UseGuards(RequiresRoleGuard));
