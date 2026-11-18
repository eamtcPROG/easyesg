import { useQuery } from '@tanstack/react-query';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { DataTable, Select } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { labelDiffQuery } from '../../queries/taxonomy-console';
import { TaxonomyRegion } from '../shared/taxonomy-region';
import { TaxonomyReadArms } from '../states/taxonomy-read-arms';

/**
 * EFRAG's labels that changed between the open pair, in a locale (task 67.6; moved here from A-03, §12.5.6's task-67.5
 * row (6)) — official only where EFRAG publishes the locale for both versions, and said so where it does not.
 */
export function LabelDiffRegion({
  pair,
  locale,
  onLocaleChange,
}: {
  readonly pair: { readonly from: string; readonly to: string };
  readonly locale: Locale;
  readonly onLocaleChange: (locale: Locale) => void;
}) {
  const t = useTranslations('platform.taxonomy.labels');
  const tLocales = useTranslations('platform.content.locales');
  const query = useQuery(labelDiffQuery({ ...pair, locale }));

  return (
    <TaxonomyRegion id="taxonomy-labels" title={t('title')} lede={t('lede', pair)}>
      <Select
        label={t('locale')}
        value={locale}
        options={LOCALES.map((candidate) => ({ value: candidate, label: tLocales(candidate) }))}
        onValueChange={(next) => {
          const chosen = LOCALES.find((candidate) => candidate === next);
          if (chosen !== undefined) onLocaleChange(chosen);
        }}
      />
      <TaxonomyReadArms
        query={query}
        ready={(diff) =>
          !diff.official ? (
            <p className="t-body text-[var(--text-muted)]">{t('unofficial')}</p>
          ) : diff.entries.length === 0 ? (
            <p className="t-body text-[var(--text-muted)]">{t('unchanged')}</p>
          ) : (
            <DataTable
              caption={t('caption', { count: diff.entries.length })}
              rows={diff.entries}
              rowKey={(row) => row.element}
              columns={[
                { key: 'change', header: t('columns.change'), cell: (row) => t(`changes.${row.change}`) },
                { key: 'before', header: t('columns.before'), cell: (row) => row.before ?? '—' },
                { key: 'after', header: t('columns.after'), cell: (row) => row.after ?? '—' },
              ]}
            />
          )
        }
      />
    </TaxonomyRegion>
  );
}
