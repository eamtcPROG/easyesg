import { Module } from '@nestjs/common';

/**
 * `core/entity` — FR-17 … FR-20
 *
 * Reporting entities, sites, consolidation scope, point-in-time master-data snapshots.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class EntityModule {}
