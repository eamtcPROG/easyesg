'use client';

import { EXPORT_FORMAT, isExportFormat } from '@easyesg/contracts';
import { LOCALES, isLocale } from '@easyesg/i18n';
import { Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { EXPORTS_FILTER_ANY, type ExportsView } from '../../tools/exports-view';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';

/**
 * The history's filter region (§4.6; task 47.3) — format and language, both written to the address (UX-4), each
 * `Select` controlled by the view rather than by local state, so Back moves the filter and nothing here is kept in step.
 * No taxonomy facet: every export of a report is at its pin (`architecture.md` §12.5.6's task-47 row (m)).
 */
export function HistoryFilters({
  view,
  onChange,
}: {
  readonly view: ExportsView;
  readonly onChange: (next: Partial<ExportsView>) => void;
}) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tLocales = useTranslations('chrome.locales');
  return (
    <div className={styles.filters} role="group" aria-label={t('history.filters.label')}>
      <Select
        label={t('history.filters.format')}
        value={view.format}
        onValueChange={(format) => onChange({ format: isExportFormat(format) ? format : EXPORTS_FILTER_ANY })}
        options={[
          { value: EXPORTS_FILTER_ANY, label: t('history.filters.any') },
          ...Object.values(EXPORT_FORMAT).map((format) => ({ value: format, label: t(`history.formats.${format}`) })),
        ]}
      />
      <Select
        label={t('history.filters.language')}
        value={view.language}
        onValueChange={(language) => onChange({ language: isLocale(language) ? language : EXPORTS_FILTER_ANY })}
        options={[
          { value: EXPORTS_FILTER_ANY, label: t('history.filters.any') },
          ...LOCALES.map((locale) => ({ value: locale, label: tLocales(locale) })),
        ]}
      />
    </div>
  );
}
