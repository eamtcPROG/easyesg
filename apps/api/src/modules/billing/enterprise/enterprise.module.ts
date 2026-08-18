import { Module } from '@nestjs/common';

/**
 * `billing/enterprise` — FR-142 … FR-147
 *
 * Quotes, contracts, additive per-subscription entitlement overrides — never a bespoke plan.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class EnterpriseModule {}
