import { Module } from '@nestjs/common';

/**
 * `core/export` — FR-48 … FR-53
 *
 * Preview and export orchestration. Always 202 + job id (AD-10); enqueued through the outbox.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({})
export class ExportModule {}
