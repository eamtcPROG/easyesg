import { Injectable } from '@nestjs/common';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { NOTIFICATION_SPECIMEN } from '@api/contracts/notification-specimens';
import { EMAIL_REQUIRED_PARTS } from '@api/infrastructure/adapters/email/email-parts';
import { renderEmailText } from '@api/infrastructure/adapters/email/email-template.renderer';
import { FIELD_LIST_FORM, type FieldListForm } from '../domain/notice-params';
import type { CategoryWording, RenderedCategoryWording } from '../interfaces/category-wording.interface';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';
import { NoticeParamsService } from './notice-params.service';

/**
 * `CATEGORY_WORDING` over the committed catalogues (task 67.10; OQ-43) — the one place A-17 reads a category's words.
 *
 * **What a channel needs is task 51.3's gate, asked live**: email its required parts (task 225), in-app a name, a title
 * and a body, in every locale. The gate holds the seed; a publication can add a channel the seed never had, and a channel
 * with no words would throw in `renderEmail` at the send rather than here. **Rendered with the category's specimen**
 * (`NOTIFICATION_SPECIMEN`), so the operator reads a message and not a placeholder (§12.5.6's task-67.10 row (1)).
 */
@Injectable()
export class CategoryWordingService implements CategoryWording {
  constructor(private readonly params: NoticeParamsService) {}

  worded(query: { readonly categoryKey: NotificationCategoryKey; readonly channel: NotificationChannel }): boolean {
    const email = query.channel === NOTIFICATION_CHANNEL.EMAIL;
    const keys = email ? EMAIL_KEYS : IN_APP_KEYS;
    return LOCALES.every((locale) =>
      keys.every((part) =>
        translate(
          locale,
          `notification.${query.categoryKey}.${part}`,
          this.specimen({ categoryKey: query.categoryKey, locale, fieldList: email ? FIELD_LIST_FORM.LINES : FIELD_LIST_FORM.SENTENCE }),
        ),
      ),
    );
  }

  render(query: { readonly categoryKey: NotificationCategoryKey; readonly locale: Locale }): RenderedCategoryWording {
    const words = (part: string) =>
      translate(query.locale, `notification.${query.categoryKey}.${part}`, this.specimen(query));
    const [title, inAppBody, action] = [words('in_app.title'), words('in_app.body'), words('in_app.action')];
    const name = words('name');
    const email = this.email(query);

    return {
      locale: query.locale,
      ...(name === undefined ? {} : { name }),
      ...(email === undefined ? {} : { email }),
      ...(title === undefined || inAppBody === undefined
        ? {}
        : { inApp: { title, body: inAppBody, ...(action === undefined ? {} : { action }) } }),
    };
  }

  /**
   * The email as a text-only client reads it — composed by the renderer from the same reading the send makes, so the
   * console cannot show words the inbox does not (task 225; §12.5.6's task-225 row (8)). `renderEmailText`, not
   * `renderEmail`: this read words every category in every locale, and the HTML part is not shown. A category missing
   * a part has no email to show, as `renderEmail` would refuse to send it.
   */
  private email(query: {
    readonly categoryKey: NotificationCategoryKey;
    readonly locale: Locale;
  }): { readonly subject: string; readonly body: string } | undefined {
    try {
      const { subject, text } = renderEmailText({
        locale: query.locale,
        templateKey: query.categoryKey,
        params: this.specimen({ ...query, fieldList: FIELD_LIST_FORM.LINES }),
      });
      return { subject, body: text };
    } catch {
      return undefined;
    }
  }

  /** The category's specimen as the locale's reader would meet it — a field list named, a date written (task 51.2). */
  private specimen(query: {
    readonly categoryKey: NotificationCategoryKey;
    readonly locale: Locale;
    readonly fieldList?: FieldListForm;
  }): Record<string, unknown> {
    return this.params.forLocale({
      params: NOTIFICATION_SPECIMEN[query.categoryKey],
      locale: query.locale,
      ...(query.fieldList === undefined ? {} : { fieldList: query.fieldList }),
    });
  }
}

/** An email's required parts (task 225), the ones `renderEmail` throws without. */
const EMAIL_KEYS = EMAIL_REQUIRED_PARTS.map((part) => `email.${part}`);
const IN_APP_KEYS = ['name', 'in_app.title', 'in_app.body'] as const;
