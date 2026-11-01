import { Module } from '@nestjs/common';

/**
 * `billing/payment` — FR-114 … FR-120
 *
 * Four rails behind one port. No card data ever reaches the platform (NFR-60, SAQ-A).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class PaymentModule {}
