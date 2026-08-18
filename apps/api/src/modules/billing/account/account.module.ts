import { Module } from '@nestjs/common';

/**
 * `billing/account` — FR-106, FR-107
 *
 * Billing account and fiscal identifiers, distinct from the organization profile.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class AccountModule {}
