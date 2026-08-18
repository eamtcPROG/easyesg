import { Module } from '@nestjs/common';

/**
 * `identity/account` — FR-1 … FR-12, FR-56 … FR-60
 *
 * Registration, email verification, password reset. Uniform responses regardless of account existence (NFR-64).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class AccountModule {}
