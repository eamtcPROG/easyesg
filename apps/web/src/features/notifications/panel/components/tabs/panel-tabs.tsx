'use client';

import { useTranslations } from 'next-intl';
import { NOTICE_LIST_MESSAGES } from '../../../shared/components/notice-messages';
import { NOTICE_SHOW, type NoticeShow } from '../../../shared/tools/notice-list-query';
import styles from '../styles/panel.module.css';

/**
 * The panel's two views, *Unread · n* and *All* (task 50.2.2) — the same two as S-26's tabs and in the same words, but
 * **toggles here rather than links**: the panel's view is its own state, so each is a button that says whether it is
 * pressed. The count is left out while it is unknown, rather than drawn as a zero it cannot vouch for.
 */
export function PanelTabs({
  show,
  unread,
  onShow,
}: {
  readonly show: NoticeShow;
  readonly unread: number | null;
  readonly onShow: (show: NoticeShow) => void;
}) {
  const t = useTranslations(`${NOTICE_LIST_MESSAGES}.show`);
  const views = [
    { show: NOTICE_SHOW.UNREAD, label: unread === null ? t('unreadUncounted') : t('unread', { count: unread }) },
    { show: NOTICE_SHOW.ALL, label: t('all') },
  ];

  return (
    <div className={styles.tabs} role="group" aria-label={t('label')}>
      {views.map((view) => (
        <button
          key={view.show}
          type="button"
          className={styles.tab}
          aria-pressed={show === view.show}
          onClick={() => onShow(view.show)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
