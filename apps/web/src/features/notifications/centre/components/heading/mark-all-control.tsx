'use client';

import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { markAllNotificationsReadAction } from '../../actions/actions';
import { CentreActionRefusal } from '../shared/centre-action-refusal';
import { CENTRE_MESSAGES } from '../shared/centre-messages';
import { useCentreAction } from '../shared/use-centre-action';
import styles from '../styles/centre.module.css';

/**
 * *Mark all as read* (task 50.2.1; §12.5.6's task-50.2 row (2)) — every notice the unread count counts, for this
 * reader alone. **No confirmation**: marking read takes nothing away — each notice stays in the centre under *All*,
 * with the time it was marked — and a question before an undoable-by-nothing-lost action is a question for nothing.
 */
export function MarkAllControl() {
  const t = useTranslations(CENTRE_MESSAGES);
  const { pending, refusal, run } = useCentreAction();

  return (
    <div className={styles.markAll}>
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        busy={pending}
        onClick={() => run(() => markAllNotificationsReadAction())}
      >
        {t('markAll')}
      </Button>
      {refusal === null ? null : <CentreActionRefusal notice={refusal} />}
    </div>
  );
}
