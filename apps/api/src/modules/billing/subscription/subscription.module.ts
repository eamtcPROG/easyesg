import { Module } from '@nestjs/common';

/**
 * `billing/subscription` — FR-90 … FR-98
 *
 * State machine: trialling | active | past due | suspended | cancelled | lapsed.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class SubscriptionModule {}
