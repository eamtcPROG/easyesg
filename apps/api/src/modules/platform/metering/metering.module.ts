import { Module } from '@nestjs/common';

/**
 * `platform/metering` — FR-105
 *
 * Append-only event stream. Lives in `audit`, not `billing`, so it keeps flowing with BILLING_ENABLED=false.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class MeteringModule {}
