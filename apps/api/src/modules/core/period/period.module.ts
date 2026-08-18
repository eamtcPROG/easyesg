import { Module } from '@nestjs/common';

/**
 * `core/period` — FR-21 … FR-23
 *
 * Reporting period lifecycle. Pins template + taxonomy version and links the prior period.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class PeriodModule {}
