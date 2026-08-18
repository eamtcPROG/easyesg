import { Module } from '@nestjs/common';

/**
 * `identity/invitation` — FR-1 … FR-12, FR-56 … FR-60
 *
 * Invitation issuance, expiry, acceptance.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class InvitationModule {}
