import { Module } from '@nestjs/common';

/**
 * `platform/taxonomy` — FR-65 … FR-70
 *
 * Version registry, inter-version mappings, migration runs that preserve pre-migration state.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class TaxonomyModule {}
