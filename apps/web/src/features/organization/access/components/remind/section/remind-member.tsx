'use client';

import { Callout, Panel } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { NOTICE_REGION } from '../../../tools/access-state';
import { REMINDER_ARM, type ReminderRegion } from '../../../tools/reminder';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../shared/remind-messages';
import { RemindForm } from '../form/remind-form';
import { NoOneToRemind } from '../states/no-one-to-remind';
import { NoOpenReport } from '../states/no-open-report';
import { RemindersUnavailable } from '../states/reminders-unavailable';
import styles from '../../styles/access.module.css';

/**
 * S-16's reminder panel (task 50.3; UC-175; `architecture.md` §12.5.6's task-50.3 row (5)) — the invite panel's
 * anatomy, one panel further down: its heading, the screen's notice where it belongs here, and which arm the
 * reminder region puts it in.
 *
 * **The region is the section's** (`remind-section.tsx`), which reads it on the server and hands it here — the part
 * renders what was read. **The notice renders here** for the invite panel's reason: *"sent to Ivan"* belongs beside the form that
 * sent it, and it is still the screen's one notice, so a reminder sent clears a row action's outcome and the reverse.
 */
export function RemindMember({ region }: { readonly region: ReminderRegion }) {
  const t = useTranslations(REMIND_MESSAGES);
  const { notice } = useAccess();

  let arm: ReactNode;
  if (region.arm === REMINDER_ARM.READY) arm = <RemindForm people={region.people} reports={region.reports} />;
  else if (region.arm === REMINDER_ARM.NO_REPORT) arm = <NoOpenReport />;
  else if (region.arm === REMINDER_ARM.NO_ONE) arm = <NoOneToRemind />;
  else arm = <RemindersUnavailable />;

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3">{t('heading')}</h2>

      {notice?.region === NOTICE_REGION.REMIND ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}

      {arm}
    </Panel>
  );
}
