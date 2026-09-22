import { Panel, Spinner } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { REMIND_MESSAGES } from '../shared/remind-messages';
import styles from '../../styles/access.module.css';

/**
 * The reminder panel's *loading — initial* (task 50.3; §8.1): the panel's frame and heading, and a status naming what
 * is awaited — S-16's own loading state's shape, one region down. It awaits only the catalogue the request has
 * already resolved, never a read (`apps/web/CLAUDE.md`'s fallback rule).
 */
export async function RemindLoading() {
  const t = await getTranslations(REMIND_MESSAGES);

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3">{t('heading')}</h2>
      <p className="t-body" role="status">
        <Spinner /> {t('loading')}
      </p>
    </Panel>
  );
}
