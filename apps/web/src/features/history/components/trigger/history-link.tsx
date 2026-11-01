'use client';

import { useTranslations } from 'next-intl';
import type { HistoryRequest } from '../../tools/history-request';
import { useHistory } from '../provider/history-context';
import { HISTORY_MESSAGES } from '../shared/history-messages';
import styles from '../styles/history.module.css';

/**
 * The way into S-12 (task 84.2; UX-68: *reached from the field, never only from an audit table*) — S-07's field footer,
 * *Changed N times · history*, where `count` is given, and S-15's and S-13's *Change history* where it is not.
 *
 * **Draws nothing for a reader who may not read the trail**: `useHistory()` answers `null` where the screen mounted no
 * provider, which it does only for an editor or the Organization Administrator (182/22). **A button, not a link**: the
 * panel is not an address (§12.5.6's task-84 row (f)), and opening it moves nothing beneath it.
 */
export function HistoryLink({ request, count }: { readonly request: HistoryRequest; readonly count?: number }) {
  const t = useTranslations(HISTORY_MESSAGES);
  const history = useHistory();
  if (history === null) return null;

  return (
    <button type="button" className={styles.link} onClick={() => history.open(request)}>
      {count === undefined ? t('open') : t('fieldFooter', { count })}
    </button>
  );
}
