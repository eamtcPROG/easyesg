'use client';

import type { ChangeEntry } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { HISTORY_MESSAGES } from '../../shared/history-messages';
import styles from '../../styles/history.module.css';
import { HistoryEntry } from './history-entry';

/**
 * S-12's entries, newest first (task 84.2; FR-54) — and, while the history holds more than has been read, the way to
 * its earlier changes beneath them (*navigate entries*), which is a press rather than a scroll so a keyboard reaches it.
 */
export function HistoryList({
  entries,
  readerAccountId,
  markCurrent,
  earlier,
  failed,
}: {
  readonly entries: readonly ChangeEntry[];
  readonly readerAccountId: string;
  readonly markCurrent: boolean;
  /** The next earlier page, where there is one — `pending` while it is read. */
  readonly earlier: { readonly pending: boolean; readonly onShow: () => void } | null;
  /** Where the last earlier page could not be read: the way to try it again. */
  readonly failed: (() => void) | null;
}) {
  const t = useTranslations(HISTORY_MESSAGES);

  return (
    <div className={styles.body}>
      <ol className={styles.entries} aria-label={t('list')}>
        {entries.map((entry, index) => (
          <HistoryEntry
            // An entry is one statement: its moment and its person, and its place for two in one instant.
            key={`${entry.at}:${entry.actor?.accountId ?? ''}:${index}`}
            entry={entry}
            readerAccountId={readerAccountId}
            current={markCurrent && index === 0}
          />
        ))}
      </ol>
      {failed === null ? null : (
        <p className={`t-caption ${styles.failed}`} role="status">
          {t('earlierFailed')}{' '}
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={failed}>
            {t('retry')}
          </Button>
        </p>
      )}
      {earlier === null || failed !== null ? null : (
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={earlier.onShow} disabled={earlier.pending} aria-busy={earlier.pending}>
          {t('earlier')}
        </Button>
      )}
    </div>
  );
}
