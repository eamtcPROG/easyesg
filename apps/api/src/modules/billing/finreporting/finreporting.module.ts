import { Module } from '@nestjs/common';

/**
 * `billing/finreporting` — FR-148 … FR-152
 *
 * VAT rules, revenue dashboard, accounting export, settlement reconciliation.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class FinreportingModule {}
