import { Module } from '@nestjs/common';

/**
 * `billing/collections` — FR-135 … FR-138
 *
 * Dunning sequence, suspension, automatic restore on settlement.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class CollectionsModule {}
