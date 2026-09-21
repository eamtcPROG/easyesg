import { Module } from '@nestjs/common';
import { NotificationCategoryCatalog } from './services/notification-category-catalog.service';

/**
 * `platform/notification` — FR-157, FR-160 … FR-173
 *
 * One notification record, N delivery records. One notice to two people on two channels stays one notification.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({
  // The category catalogue (task 49.1). Its first consumer is 49.3's dispatch, in this module, so nothing is
  // exported until a producer outside it needs to ask a category's behaviour.
  providers: [NotificationCategoryCatalog],
})
export class NotificationModule {}
