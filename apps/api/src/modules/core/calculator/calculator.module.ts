import { Module } from '@nestjs/common';

/**
 * `core/calculator` — FR-33 … FR-36
 *
 * Scope 1 + location-based Scope 2. Raw inputs retained permanently; results pinned to a factor-set version.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class CalculatorModule {}
