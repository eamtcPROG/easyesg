import { Module } from '@nestjs/common';

/**
 * `core/organization` — FR-13 … FR-16
 *
 * Organization aggregate and typed org relationships. Lives in `core`, not a tenancy schema; `billing` references it by id with no FK (NFR-15).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class OrganizationModule {}
