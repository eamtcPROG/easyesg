'use client';

import type { NotificationPreferences } from '@easyesg/contracts';
import { Fieldset, RecordSection } from '@easyesg/ui';
import { FormCheckbox } from '@easyesg/ui/forms';
import { useFormatter, useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { ACCOUNT_PREFERENCES_SECTION } from '@/lib/routes';
import { switchIndex, type ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import styles from '../styles/profile.module.css';

/**
 * What reaches the person, and where (task 52.3; UC-168, FR-163, BR-NOT-2, UX-65) — every category they can receive,
 * each on the channels it travels on, the read 52.1 built.
 *
 * **A category nobody may switch off is drawn locked, with the reason stated** (UX-65): no control, and a sentence
 * saying why, since a row with no control invites the reader to look for it elsewhere. **The others are one checkbox
 * per channel**, bound to the switch at that pair's index — the order `toFields` built them in, the read's own order.
 *
 * **A group per category rather than the artboard's table**: each group is a `Fieldset` whose legend names the
 * category, so a checkbox's accessible name carries both the category and the channel, which a bare cell under a
 * column header would not — and §11.5 has no table of form controls to draw one with.
 */
export function NotificationsSection({
  control,
  preferences,
}: {
  readonly control: Control<ProfileFields>;
  readonly preferences: NotificationPreferences;
}) {
  const t = useTranslations(PROFILE_MESSAGES);
  const format = useFormatter();

  return (
    <RecordSection
      id={ACCOUNT_PREFERENCES_SECTION}
      heading={t('notifications.heading')}
      description={t('notifications.lede')}
    >
      <div className={styles.categories}>
        {preferences.categories.map((category) => (
          <Fieldset key={category.categoryKey} legend={category.categoryName ?? t('notifications.unnamed')}>
            {category.mandatory ? (
              <p className={`t-caption ${styles.locked}`}>
                {t('notifications.locked', {
                  channels: format.list(
                    category.channels.map(({ channel }) => t(`notifications.channel.${channel}`)),
                    'enumeration',
                  ),
                })}
              </p>
            ) : (
              <div className={styles.channels}>
                {category.channels.map(({ channel }) => (
                  <FormCheckbox
                    key={channel}
                    control={control}
                    name={`switches.${switchIndex({ preferences, categoryKey: category.categoryKey, channel })}.enabled`}
                    label={t(`notifications.channel.${channel}`)}
                  />
                ))}
              </div>
            )}
          </Fieldset>
        ))}
      </div>
    </RecordSection>
  );
}
