import { Module } from '@nestjs/common';

/**
 * `platform/configuration` — FR-61, FR-62, FR-71 … FR-74
 *
 * The configuration store (AD-4): draft → in review → published → superseded, revert in one step.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class ConfigurationModule {}
