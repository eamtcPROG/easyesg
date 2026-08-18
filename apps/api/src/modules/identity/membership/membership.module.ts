import { Module } from '@nestjs/common';

/**
 * `identity/membership` — FR-1 … FR-12, FR-56 … FR-60
 *
 * Organization membership, role, per-report rights. Revocation without cascading historical attribution.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class MembershipModule {}
