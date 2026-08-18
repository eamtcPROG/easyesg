import { Module } from '@nestjs/common';

/**
 * `billing/efactura` — FR-126, FR-127
 *
 * National e-invoicing. Mandate binds from the first paid invoice, 1 Oct 2026 (D-9).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class EfacturaModule {}
