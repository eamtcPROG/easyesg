'use client';

import { Callout, Panel, USAGE_STANDING } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { NOTICE_REGION } from '../../../tools/access-state';
import { useAccess } from '../../shared/access-context';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { InvitationsPaused } from '../states/invitations-paused';
import { InviteForm } from '../form/invite-form';
import { SeatsFull } from '../states/seats-full';
import styles from '../../styles/access.module.css';

/**
 * S-16's invite panel: its heading, the screen's notice where it belongs here, and which of three
 * arms the seat region puts it in (UC-60; task 142 for the arms).
 *
 * **The arm is the seat region's, computed once in the section** and read from the provider, so this
 * panel and the counter in the heading cannot disagree about whether the organization is full. At
 * the ceiling the form gives way to the entitlement gate (UX-50); with the ceiling unreadable, to a
 * notice that invitations are paused, since the API refuses them then. The heading stays in every
 * arm, because the first-use empty state links to it.
 *
 * **The notice renders here rather than at the list's head** (28 Aug 2026): the invitation's refusal
 * points at "the list above", a sentence only true below the list — see `NOTICE_REGION`. It is the
 * screen's one notice, not this panel's own; the defect `access-state.ts`'s `ACTION_STARTED` branch
 * was written for is this panel keeping one of its own.
 */
export function InviteMember({ id }: { id: string }) {
  const t = useTranslations(`${ACCESS_MESSAGES}.invite`);
  const { notice, seats } = useAccess();

  let arm: ReactNode;
  if (seats.standing === USAGE_STANDING.UNKNOWN) arm = <InvitationsPaused />;
  else if (seats.standing === USAGE_STANDING.REACHED) arm = <SeatsFull region={seats} />;
  else arm = <InviteForm />;

  return (
    <Panel className={styles.invitePanel}>
      <h2 className="t-heading-3" id={id}>
        {t('heading')}
      </h2>

      {notice?.region === NOTICE_REGION.INVITE ? (
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      ) : null}

      {arm}
    </Panel>
  );
}
