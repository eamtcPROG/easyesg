import type { ConsoleCategory } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'use-intl';
import { CategoryChannelsText } from '../shared/category-channels-text';
import { ClassificationChip } from '../shared/classification-chip';

/**
 * A-17's facts about one category (task 67.10) — where it travels, whether recipients may switch it off, what code
 * declares about it, who switched it off, and its last publication. **What code declares is said, not implied**: a
 * mandatory category's fixed controls would otherwise read as a screen that forgot to offer them.
 */
export function CategoryFacts({ category }: { readonly category: ConsoleCategory }) {
  const t = useTranslations('platform.notificationCategories.record');
  const format = useFormatter();
  const { inForce, switchOffs } = category;

  return (
    <dl className="t-body grid grid-cols-[auto_1fr] items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
      <dt className="text-[var(--text-muted)]">{t('channels')}</dt>
      <dd>
        <CategoryChannelsText inForce={inForce} />
      </dd>

      <dt className="text-[var(--text-muted)]">{t('classification')}</dt>
      <dd>{inForce?.classification == null ? t('unknown') : <ClassificationChip classification={inForce.classification} />}</dd>

      {category.mandatory || category.addressNotice ? (
        <>
          <dt className="text-[var(--text-muted)]">{t('declared')}</dt>
          <dd className="flex flex-col gap-[var(--space-1)]">
            {category.mandatory ? <span>{t('mandatory')}</span> : null}
            {category.addressNotice ? <span>{t('addressNotice')}</span> : null}
          </dd>
        </>
      ) : null}

      <dt className="text-[var(--text-muted)]">{t('switchOffs')}</dt>
      <dd className="flex flex-col gap-[var(--space-1)]">
        <span>{t('people', { count: switchOffs.people })}</span>
        {switchOffs.people === 0 ? null : (
          <span className="t-caption text-[var(--text-muted)]">
            {t('byChannel', { inApp: switchOffs.inApp, email: switchOffs.email })}
          </span>
        )}
      </dd>

      <dt className="text-[var(--text-muted)]">{t('changed')}</dt>
      <dd>
        {inForce?.publishedAt == null
          ? t('neverChanged')
          : inForce.publishedBy === null
            ? t('changedWithoutOperator', { time: format.dateTime(inForce.publishedAt, 'stamp') })
            : t('changedBy', { email: inForce.publishedBy, time: format.dateTime(inForce.publishedAt, 'stamp') })}
      </dd>
    </dl>
  );
}
