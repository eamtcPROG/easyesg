import type { Locale } from '@easyesg/i18n';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * A category's wording as A-17 needs it (task 67.10) — whether a channel is worded in every catalogue, and the words
 * rendered with the category's specimen. **A port because the catalogue is the app's**, and the use cases stay
 * framework-free without it.
 */
export interface CategoryWording {
  /** Whether every locale's catalogue carries what `channel` needs — task 51.3's gate, asked of a publication. */
  worded(query: { readonly categoryKey: NotificationCategoryKey; readonly channel: NotificationChannel }): boolean;
  /** The category's words in one locale, rendered with its specimen; a member absent where none is written. */
  render(query: { readonly categoryKey: NotificationCategoryKey; readonly locale: Locale }): RenderedCategoryWording;
}

export interface RenderedCategoryWording {
  readonly locale: Locale;
  readonly name?: string;
  readonly email?: { readonly subject: string; readonly body: string };
  readonly inApp?: { readonly title: string; readonly body: string; readonly action?: string };
}

export const CATEGORY_WORDING = Symbol('CATEGORY_WORDING');
