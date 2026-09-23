import { BADGE_TONE, BUTTON_VARIANT, Badge, TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { getTranslations } from 'next-intl/server';
import { NoticeMarkAll } from '../../../shared/components/notice-mark-all';
import { NOTICE_LIST_MESSAGES } from '../../../shared/components/notice-messages';
import type { CentreView } from '../../tools/centre-view';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import styles from '../styles/centre.module.css';
import { ReadStateTabs } from './read-state-tabs';
import { ReceivedOrder } from './received-order';

/**
 * S-26's heading, as the artboard draws it (task 50.2.1): the title with the unread count beside it, the lede, and
 * at the row's end the read-state tabs, the order and *Mark all as read* (§12.5.6's task-50.2 rows (2), (4), (6)) —
 * the order the one control the artboard does not draw, which §4.6's Index carries.
 *
 * **The count and the controls need the read**, so on a refused or failed one the heading is the title and lede
 * alone — a count this screen could not read is not drawn as zero, and tabs over a list it could not load would
 * offer a choice with nothing behind it. *Mark all* is offered only while something is unread.
 */
export async function CentreHeading({ unread, view }: { readonly unread: number | null; readonly view: CentreView }) {
  const [t, tLists] = await Promise.all([getTranslations(CENTRE_MESSAGES), getTranslations(NOTICE_LIST_MESSAGES)]);

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.titleRow}>
          <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
          {unread !== null && unread > 0 ? (
            <Badge tone={BADGE_TONE.ALERT} count={unread} label={tLists('unreadCount', { count: unread })} />
          ) : null}
        </div>
        <p className={`t-body ${styles.lede}`}>{t('lede')}</p>
        {/* S-26's route to preferences (`design_spec.md` S-26's exits), arrived with S-27 in task 52.3: the section of
            S-27 that says what reaches the reader and where. */}
        <TextLink asChild>
          <Link href={ROUTES.ACCOUNT_PREFERENCES}>{t('preferences')}</Link>
        </TextLink>
      </div>
      {unread === null ? null : (
        <div className={styles.controls}>
          <ReadStateTabs view={view} unread={unread} />
          <ReceivedOrder view={view} />
          {unread > 0 ? <NoticeMarkAll variant={BUTTON_VARIANT.SECONDARY} /> : null}
        </div>
      )}
    </header>
  );
}
