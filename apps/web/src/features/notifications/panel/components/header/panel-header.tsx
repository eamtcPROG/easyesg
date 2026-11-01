'use client';

import { BADGE_TONE, BUTTON_VARIANT, Badge } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Popover } from 'radix-ui';
import { NoticeMarkAll } from '../../../shared/components/notice-mark-all';
import { NOTICE_LIST_MESSAGES } from '../../../shared/components/notice-messages';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import styles from '../styles/panel.module.css';

/**
 * The panel's heading row, as the artboard draws it (task 50.2.2): the title with the unread count beside it, then
 * *mark all*, offered only while something is unread, and the close control.
 *
 * **The close is a word, where the artboard draws a ×.** This app writes no text outside its catalogues, and a glyph
 * written as a string would be text; the icon set is `packages/ui`'s, whose one close glyph is drawn inside
 * `ChromeDrawer` rather than offered as a part a caller can place. Escape and a click outside close the panel too.
 */
export function PanelHeader({ titleId, unread }: { readonly titleId: string; readonly unread: number | null }) {
  const t = useTranslations(PANEL_MESSAGES);
  const tLists = useTranslations(NOTICE_LIST_MESSAGES);

  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h2 id={titleId} className={`t-heading-3 ${styles.title}`}>
          {t('title')}
        </h2>
        {unread !== null && unread > 0 ? (
          <Badge tone={BADGE_TONE.ALERT} count={unread} label={tLists('unreadCount', { count: unread })} />
        ) : null}
      </div>
      <div className={styles.headerControls}>
        {unread !== null && unread > 0 ? <NoticeMarkAll variant={BUTTON_VARIANT.SUBTLE} /> : null}
        <Popover.Close className={styles.close}>{t('close')}</Popover.Close>
      </div>
    </div>
  );
}
