'use client';

import { useTranslations } from 'next-intl';
import { HISTORY_MESSAGES } from '../../shared/history-messages';
import styles from '../../styles/history.module.css';

/**
 * S-12's *empty — first use* (§8.1): nothing has changed yet — a field never answered, or a record the trail holds
 * nothing about. A fact, not a failure, so it is said plainly rather than raised as a callout.
 */
export function HistoryEmpty() {
  const t = useTranslations(HISTORY_MESSAGES);
  return <p className={`t-body ${styles.state}`}>{t('empty')}</p>;
}
