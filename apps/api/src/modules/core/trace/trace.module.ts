import { Module } from '@nestjs/common';

/**
 * `core/trace` — FR-54, FR-55
 *
 * Per-field change history. Attribution survives membership removal.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class TraceModule {}
