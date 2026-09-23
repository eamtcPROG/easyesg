import { Injectable } from '@nestjs/common';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { NOTIFICATION_SPECIMEN } from '@api/contracts/notification-specimens';
import type { CategoryWording, RenderedCategoryWording } from '../interfaces/category-wording.interface';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';

/**
 * `CATEGORY_WORDING` over the committed catalogues (task 67.10; OQ-43) — the one place A-17 reads a category's words.
 *
 * **What a channel needs is task 51.3's gate, asked live**: email a subject and a body, in-app a name, a title and a
 * body, in every locale. The gate holds the seed; a publication can add a channel the seed never had, and a channel
 * with no words would throw in `renderEmail` at the send rather than here. **Rendered with the category's specimen**
 * (`NOTIFICATION_SPECIMEN`), so the operator reads a message and not a placeholder (§12.5.6's task-67.10 row (1)).
 */
@Injectable()
export class CategoryWordingService implements CategoryWording {
  worded(query: { readonly categoryKey: NotificationCategoryKey; readonly channel: NotificationChannel }): boolean {
    const keys = query.channel === NOTIFICATION_CHANNEL.EMAIL ? EMAIL_KEYS : IN_APP_KEYS;
    return LOCALES.every((locale) =>
      keys.every((part) => translate(locale, `notification.${query.categoryKey}.${part}`, specimenOf(query.categoryKey))),
    );
  }

  render(query: { readonly categoryKey: NotificationCategoryKey; readonly locale: Locale }): RenderedCategoryWording {
    const words = (part: string) =>
      translate(query.locale, `notification.${query.categoryKey}.${part}`, specimenOf(query.categoryKey));
    const [subject, body] = [words('subject'), words('body')];
    const [title, inAppBody, action] = [words('in_app.title'), words('in_app.body'), words('in_app.action')];
    const name = words('name');

    return {
      locale: query.locale,
      ...(name === undefined ? {} : { name }),
      ...(subject === undefined || body === undefined ? {} : { email: { subject, body } }),
      ...(title === undefined || inAppBody === undefined
        ? {}
        : { inApp: { title, body: inAppBody, ...(action === undefined ? {} : { action }) } }),
    };
  }
}

const EMAIL_KEYS = ['subject', 'body'] as const;
const IN_APP_KEYS = ['name', 'in_app.title', 'in_app.body'] as const;

const specimenOf = (categoryKey: NotificationCategoryKey): Record<string, unknown> => ({ ...NOTIFICATION_SPECIMEN[categoryKey] });
