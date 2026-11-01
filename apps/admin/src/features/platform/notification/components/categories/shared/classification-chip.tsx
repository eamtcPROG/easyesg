import type { NotificationClassification } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * **Admission test** (`shared-admission-test`): read by more than one part of the categories region — the table's
 * classification column and the record's facts — and by nothing outside it.
 *
 * Whether recipients may switch a category off, as a chip (task 67.10). **Neutral either way**: a category nobody may
 * switch off is the platform's ordinary answer for a security notice, and one people may switch off is not an
 * achievement — the words carry the difference, and no tone would be true of both.
 */
export function ClassificationChip({ classification }: { readonly classification: NotificationClassification }) {
  const t = useTranslations('platform.notificationCategories.classification');

  return <StatusChip tone={STATUS_TONE.NEUTRAL}>{t(classification)}</StatusChip>;
}
