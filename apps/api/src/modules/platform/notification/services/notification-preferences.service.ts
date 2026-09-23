import { Injectable } from '@nestjs/common';
import { translate } from '@api/app/messages/catalogue';
import { requestContext, requestLocale } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type {
  CategoryPreferences,
  CategoryPreferencesItem,
  NotificationPreferencePair,
} from '../models/notification-preference.model';
import { ReadNotificationPreferences } from '../use-cases/read-notification-preferences.use-case';
import { SetNotificationPreferences } from '../use-cases/set-notification-preferences.use-case';

/**
 * The Nest-aware seam between `NotificationPreferencesController` and its two use cases (task 52.1; UC-168), and
 * where the two ambient values are resolved: **the account, from the session** — never from the wire, so no caller can
 * read or write another person's preferences — and **each category's name, in the negotiated language**, from
 * `notification.<category>.name`, the key the centre names a notice's category by (§12.5.6's task-50.2 row (3)). A
 * category with no name written is listed without one, the problem document's rule, rather than under its key.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly readPreferences: ReadNotificationPreferences,
    private readonly setPreferences: SetNotificationPreferences,
  ) {}

  async read(): Promise<readonly CategoryPreferencesItem[]> {
    return named(await this.readPreferences.execute({ accountId: sessionAccount() }));
  }

  async set(input: { readonly switchedOff: readonly NotificationPreferencePair[] }): Promise<readonly CategoryPreferencesItem[]> {
    return named(await this.setPreferences.execute({ ...input, accountId: sessionAccount() }));
  }
}

/**
 * `AuthGuard` closes the surface by default, so reaching here without an actor is a wiring defect rather than a request
 * — refused rather than asserted, `PasswordService`'s reading, so a guard regression is a 401 and not a `TypeError`.
 */
const sessionAccount = (): string => {
  const actorId = requestContext()?.actorId;
  if (actorId === undefined) throw new AuthenticationRequiredError();
  return actorId;
};

const named = (categories: readonly CategoryPreferences[]): CategoryPreferencesItem[] => {
  const locale = requestLocale();
  return categories.map((category) => ({
    ...category,
    categoryName: translate(locale, `notification.${category.categoryKey}.name`),
  }));
};
