import { Module } from '@nestjs/common';

/**
 * `billing/catalogue` — FR-84 … FR-89
 *
 * Plans, entitlements, prices, discounts — versioned data, never code (AD-4).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class CatalogueModule {}
