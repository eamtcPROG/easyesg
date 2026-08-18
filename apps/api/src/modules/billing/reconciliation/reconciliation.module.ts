import { Module } from '@nestjs/common';

/**
 * `billing/reconciliation` — FR-131 … FR-134
 *
 * Statement import and matching. Manual settlement writes to the immutable ledger.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class ReconciliationModule {}
