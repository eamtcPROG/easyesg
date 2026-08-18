import { Module } from '@nestjs/common';

/**
 * `billing/entitlement` — FR-99 … FR-105
 *
 * Implements contracts/entitlement.port. Key lookup, not a method per feature (AD-5).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class EntitlementModule {}
