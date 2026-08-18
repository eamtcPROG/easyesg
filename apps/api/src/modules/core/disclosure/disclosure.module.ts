import { Module } from '@nestjs/common';

/**
 * `core/disclosure` — FR-24 … FR-32
 *
 * Taxonomy-keyed disclosure store (AD-3). The element key IS the VSME XBRL element local name.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class DisclosureModule {}
