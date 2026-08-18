import { Module } from '@nestjs/common';

/**
 * `platform/localization` — FR-63, FR-64
 *
 * Locale registration, label resolution, per-key fallback logging into a review queue.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class LocalizationModule {}
