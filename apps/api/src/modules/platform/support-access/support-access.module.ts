import { Module } from '@nestjs/common';

/**
 * `platform/support-access` — FR-77, FR-78, FR-79
 *
 * Time-boxed, reasoned, ticket-referenced grants that expire without administrator action (D-5).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class SupportAccessModule {}
