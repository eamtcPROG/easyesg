'use client';

import { USAGE_STANDING } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ACCESS_PANEL } from '../../../tools/access-panel';
import { AccessDialog } from '../../shared/access-dialog';
import { useAccess } from '../../shared/access-context';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { InvitationsPaused } from '../states/invitations-paused';
import { InviteForm } from '../form/invite-form';
import { SeatsFull } from '../states/seats-full';

/**
 * S-16's invitation, UC-60 — which of three arms the seat region puts the dialogue in (task 142 for the
 * arms; a dialogue over the list since 28 Sep 2026, where it had been a panel below it).
 *
 * **The arm is the seat region's, computed once in the section** and read from the provider, so this
 * and the counter in the heading cannot disagree about whether the organization is full. At the ceiling
 * the form gives way to the entitlement gate (UX-50); with the ceiling unreadable, to a notice that
 * invitations are paused, since the API refuses them then. **The button that opens it is offered in
 * every arm**, so the reader who presses it at the ceiling is told why no form follows rather than
 * finding a control that does nothing — the form is still not offered, which is what §5's row asks.
 *
 * The form frames itself, because its closing row carries the submit and the submit's pending state is
 * the form's; the two states have nothing to press, and are framed here.
 */
export function InviteMember() {
  const t = useTranslations(`${ACCESS_MESSAGES}.invite`);
  const { seats, panel } = useAccess();

  if (seats.standing === USAGE_STANDING.UNKNOWN) {
    return (
      <AccessDialog panel={ACCESS_PANEL.INVITE} title={t('heading')}>
        <InvitationsPaused />
      </AccessDialog>
    );
  }
  if (seats.standing === USAGE_STANDING.REACHED) {
    return (
      <AccessDialog panel={ACCESS_PANEL.INVITE} title={t('heading')}>
        <SeatsFull region={seats} />
      </AccessDialog>
    );
  }
  // Keyed on the dialogue being open, so every opening is a new form: the form lives outside the
  // dialogue's content, which unmounts on close, and would otherwise keep the last attempt's fields.
  return <InviteForm key={panel === ACCESS_PANEL.INVITE ? 'open' : 'closed'} />;
}
