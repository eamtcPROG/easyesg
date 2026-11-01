'use client';

import { EXPORT_STATUS, type Export } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, COLUMN_SIZE, type DataTableColumn } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { exportFileAddress } from '@/client/exports/read-export';
import { EXPORTS_COLUMN, type ExportsColumnKey } from '../../tools/exports-view';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';
import { ExportStatusChip } from './export-status-chip';
import { WatchedStatus } from './watched-status';

/**
 * The history's columns (task 47.3; UX-49): when it was asked for and by whom, the file — its format and language — the
 * versions it was made at, its standing, and the download, which a completed export alone carries. **Every row stays**,
 * a failed one included: what was distributed stays retrievable exactly as it was (FR-53), and what failed says so.
 *
 * Memoised on the two locale-bound things it reads: a fresh array every render would redraw the table's body.
 */
export function useHistoryColumns(): readonly DataTableColumn<Export, ExportsColumnKey>[] {
  const t = useTranslations(EXPORTS_MESSAGES);
  const tLocales = useTranslations('chrome.locales');
  const format = useFormatter();

  return useMemo(() => {
    const when = (row: Export): string => format.dateTime(row.requestedAt, 'stamp');
    return [
      {
        key: EXPORTS_COLUMN.REQUESTED,
        header: t('history.columns.requested'),
        sortable: true,
        size: COLUMN_SIZE.FILL,
        cell: (row: Export) =>
          t('history.requested', { when: when(row), person: row.requestedBy.name ?? t('history.personUnknown') }),
      },
      {
        key: EXPORTS_COLUMN.FILE,
        header: t('history.columns.file'),
        size: COLUMN_SIZE.FIT,
        cell: (row: Export) =>
          t('history.file', { format: t(`history.formats.${row.format}`), language: tLocales(row.locale) }),
      },
      {
        key: EXPORTS_COLUMN.VERSIONS,
        header: t('history.columns.versions'),
        size: COLUMN_SIZE.FIT,
        cell: (row: Export) => (
          <span className={styles.muted}>
            {t('history.versions', { taxonomy: row.taxonomyVersion, template: row.templateVersion })}
          </span>
        ),
      },
      {
        key: EXPORTS_COLUMN.STATUS,
        header: t('history.columns.status'),
        size: COLUMN_SIZE.FIT,
        cell: (row: Export) =>
          row.status === EXPORT_STATUS.REQUESTED ? <WatchedStatus row={row} /> : <ExportStatusChip status={row.status} />,
      },
      {
        key: EXPORTS_COLUMN.ACTION,
        header: t('history.columns.action'),
        size: COLUMN_SIZE.FIT,
        cell: (row: Export) =>
          row.status === EXPORT_STATUS.COMPLETED ? (
            <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
              {/* Named for its row: a screen reader lists every download, and seven "Download"s name nothing. */}
              <a
                href={exportFileAddress(row.id)}
                download
                aria-label={t('history.downloadLabel', { format: row.format, when: when(row) })}
              >
                {t('history.download')}
              </a>
            </Button>
          ) : null,
      },
    ];
  }, [format, t, tLocales]);
}
