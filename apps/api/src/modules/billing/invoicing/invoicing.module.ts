import { Module } from '@nestjs/common';

/**
 * `billing/invoicing` — FR-121 … FR-130
 *
 * Immutable fiscal documents, gaplessly numbered per series per year (AD-7, DR-8).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class InvoicingModule {}
