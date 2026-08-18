import { Module } from '@nestjs/common';

/**
 * `billing/refunds` — FR-139 … FR-141
 *
 * Refund authority separated from invoice issuance. Entitlement reversal is a distinct step.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class RefundsModule {}
