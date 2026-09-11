'use client';

import { Select } from '@easyesg/ui';
import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { useAccess } from './access-context';
import { ACCESS_FILTER_ANY, ACCESS_STANDING, type AccessView } from '../access';
import styles from './access.module.css';

/**
 * The Index's filter region (§4.6) — two facets, both written to the URL.
 *
 * There is no free-text search, and that is a decision rather than a gap: the collection is bounded
 * by the plan's seat entitlement, so an organization's whole list is a screenful or two, and the
 * two facets a reader actually asks by are "who can change things" and "who has not accepted yet".
 * A search box would be a third control earning its place only once a list outgrows the eye.
 *
 * Each `Select` is controlled by `view` rather than by local state. The URL is the single source
 * (UX-4), so a browser Back button moves the filter, and there is nothing here to keep in step.
 */
export function AccessFilters() {
  const t = useTranslations('organization.access');
  const { view, setView } = useAccess();

  return (
    <div className={styles.filters}>
      <Select
        label={t('filters.role')}
        value={view.role}
        onValueChange={(role) => setView({ role: role as AccessView['role'] })}
        options={[
          { value: ACCESS_FILTER_ANY, label: t('filters.anyRole') },
          ...Object.values(MEMBERSHIP_ROLE).map((role) => ({
            value: role,
            label: t(`roles.${role}`),
          })),
        ]}
      />
      <Select
        label={t('filters.standing')}
        value={view.standing}
        onValueChange={(standing) => setView({ standing: standing as AccessView['standing'] })}
        options={[
          { value: ACCESS_FILTER_ANY, label: t('filters.anyStanding') },
          ...Object.values(ACCESS_STANDING).map((standing) => ({
            value: standing,
            label: t(`standings.${standing}`),
          })),
        ]}
      />
    </div>
  );
}
