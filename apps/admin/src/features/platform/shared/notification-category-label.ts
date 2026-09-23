import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@easyesg/contracts';

/**
 * **Admission test** (`shared-admission-test`): read by more than one platform feature — A-17's categories and A-08's
 * log, which names the category a publication put in force — and by nothing in billing.
 *
 * How the console names a notification category (task 67.10). **A category's wire value is dotted and a message key's
 * segments are dots**, so the value cannot be the key — `LOG_ACTION_LABEL`'s reason — and this table is the one place
 * the two meet, under `platform.notificationCategories.categories`; `satisfies` fails the build when a category
 * arrives without a name. **The console's own words**, not the tenant catalogue's: the operator invitation reaches no
 * tenant and has no name there.
 */
export const NOTIFICATION_CATEGORY_LABEL = {
  [NOTIFICATION_CATEGORY.EMAIL_VERIFICATION]: 'emailVerification',
  [NOTIFICATION_CATEGORY.PASSWORD_RESET]: 'passwordReset',
  [NOTIFICATION_CATEGORY.INVITATION]: 'invitation',
  [NOTIFICATION_CATEGORY.ADMIN_INVITATION]: 'adminInvitation',
  [NOTIFICATION_CATEGORY.MANUAL_REMINDER]: 'manualReminder',
} as const satisfies Record<NotificationCategoryKey, string>;
