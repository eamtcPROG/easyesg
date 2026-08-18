import { Module } from '@nestjs/common';

/**
 * `core/validation` — FR-40 … FR-44
 *
 * Rule interpreter over registered rule definitions (AD-4), not over hardcoded checks.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class ValidationModule {}
