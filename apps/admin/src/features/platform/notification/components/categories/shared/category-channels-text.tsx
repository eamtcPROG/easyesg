import type { ConsoleCategory } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'use-intl';

/**
 * **Admission test** (`shared-admission-test`): read by more than one part of the categories region — the table's
 * channels column and the record's facts — and by nothing outside it.
 *
 * The channels a category travels on, as a list in words (task 67.10). **Three answers, and they are different
 * states**: the channels, nothing published yet, and an artefact that cannot be read — the fail-closed state the
 * platform is actually in, which must not look like a category with no channels.
 */
export function CategoryChannelsText({ inForce }: { readonly inForce: ConsoleCategory['inForce'] }) {
  const t = useTranslations('platform.notificationCategories');
  const format = useFormatter();

  if (inForce === null) return t('notPublished');
  if (inForce.channels === null) return t('unreadable');
  return format.list(
    inForce.channels.map((channel) => t(`channels.${channel}`)),
    'enumeration',
  );
}
