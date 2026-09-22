import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * The channel decision the delivery use cases ask for — `CategoryChannels`' shape, named so no framework class enters
 * a use case (task 49.3). Its own file since a second use case reads it (task 50.1.4).
 */
export interface NotificationChannelDecision {
  channelsFor(query: { readonly categoryKey: NotificationCategoryKey }): readonly NotificationChannel[];
}
