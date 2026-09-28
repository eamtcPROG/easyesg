'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ACCESS_PANEL } from '../../../tools/access-panel';
import { REMINDER_ARM, type ReminderRegion } from '../../../tools/reminder';
import { AccessDialog } from '../../shared/access-dialog';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../shared/remind-messages';
import { RemindForm } from '../form/remind-form';
import { NoOneToRemind } from '../states/no-one-to-remind';
import { NoOpenReport } from '../states/no-open-report';
import { RemindersUnavailable } from '../states/reminders-unavailable';

/**
 * S-16's reminder, UC-175 (task 50.3; `architecture.md` §12.5.6's task-50.3 row (5) as amended 28 Sep 2026) — a
 * dialogue over the list, where it had been a panel below it, opened from the filter row's button or from a member's
 * row with them chosen. This picks which arm the reminder region puts it in.
 *
 * **The region is the section's** (`remind-section.tsx`), which reads it on the server and hands it here — the part
 * renders what was read. **Every arm is offered from every opening**: a row's *remind* is on every member it may go
 * to whether or not a report is open, and the dialogue says what is missing rather than the list waiting on these
 * reads to decide whether to show it (the project owner's choice, 28 Sep 2026).
 *
 * The form frames itself, because its closing row carries the submit and the submit's pending state is the form's;
 * the three states have nothing to press, and are framed here.
 */
export function RemindMember({ region }: { readonly region: ReminderRegion }) {
  const t = useTranslations(REMIND_MESSAGES);
  const { panel, remindPerson } = useAccess();

  if (region.arm === REMINDER_ARM.READY) {
    // Keyed on the opening and on whom it opened for, so each opening is a new form chosen for them: the form
    // lives outside the dialogue's content, which unmounts on close, and its default is read once, at mount.
    const opening = panel === ACCESS_PANEL.REMIND ? `open:${remindPerson ?? ''}` : 'closed';
    return <RemindForm key={opening} people={region.people} reports={region.reports} person={remindPerson} />;
  }

  let state: ReactNode;
  if (region.arm === REMINDER_ARM.NO_REPORT) state = <NoOpenReport />;
  else if (region.arm === REMINDER_ARM.NO_ONE) state = <NoOneToRemind />;
  else state = <RemindersUnavailable />;

  return (
    <AccessDialog panel={ACCESS_PANEL.REMIND} title={t('heading')}>
      {state}
    </AccessDialog>
  );
}
