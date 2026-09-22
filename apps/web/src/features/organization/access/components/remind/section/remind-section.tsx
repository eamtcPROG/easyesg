import { readReminderChoices } from '@/server/data/reminders';
import { readSession } from '@/server/session/session';
import { reminderRegion } from '../../../tools/reminder';
import { RemindMember } from './remind-member';

/**
 * S-16's reminder panel as a region of its own (task 50.3; `section-reads-parts-render`): its two reads — every
 * member, every report — and the session's account, which is the sender, and the arm they put the panel in.
 *
 * **Its own region, under its own boundary**, rather than a third read in the list's section: the list does not
 * depend on either read, so it does not wait on them, and a failure of either is this panel's partial state alone.
 * Rendered inside the screen's provider all the same, because the screen holds one notice across its regions.
 */
export async function RemindSection() {
  const [choices, session] = await Promise.all([readReminderChoices(), readSession()]);
  return <RemindMember region={reminderRegion({ ...choices, senderAccountId: session?.account.id ?? null })} />;
}
