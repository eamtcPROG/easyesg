import { Module } from '@nestjs/common';

/**
 * `platform/audit` — FR-79, FR-81, FR-151, FR-159
 *
 * System audit log and billing ledger. Append-only at database privilege level (DR-6).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class AuditModule {}
