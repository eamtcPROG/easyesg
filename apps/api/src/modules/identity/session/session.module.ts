import { Module } from '@nestjs/common';

/**
 * `identity/session` — FR-1 … FR-12, FR-56 … FR-60
 *
 * Short-lived access tokens; opaque server-side refresh sessions rotated on use (AD-12).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class SessionModule {}
