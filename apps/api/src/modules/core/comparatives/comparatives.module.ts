import { Module } from '@nestjs/common';

/**
 * `core/comparatives` — FR-45 … FR-47
 *
 * Prior-period resolution and carry-forward. No HTTP surface of its own.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class ComparativesModule {}
