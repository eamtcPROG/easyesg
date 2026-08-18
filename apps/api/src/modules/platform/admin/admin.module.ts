import { Module } from '@nestjs/common';

/**
 * `platform/admin` — FR-75, FR-76, FR-80, FR-82, FR-83
 *
 * Platform administration behind the separate admin realm (NFR-65).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class AdminModule {}
