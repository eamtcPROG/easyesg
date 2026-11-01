import { Module } from '@nestjs/common';

/**
 * `billing/order` — FR-108 … FR-113
 *
 * Order saga with persisted state and compensations (AD-6).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class OrderModule {}
