'use client';

import { ConsequenceDialogue, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, type MouseEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { useAutosaveContext } from './autosave-context';

/**
 * UX-5's single, always-visible way out — and UX-37's second half (task 35.2): *"warned again — with
 * a chance to cancel — on any navigation away … that would abandon a queue"*.
 *
 * **An ordinary link until there is something unsent.** With the queue empty the anchor navigates
 * as any anchor does, and the label's claim — *"your work is saved"* — is true. With the queue
 * non-empty the click is intercepted and a consequence dialogue (§6.14, UX-70) names what is at
 * stake: the changes stay on this device and are sent the next time this report is opened here,
 * which is honest about the durable queue rather than alarming about it, and the reader may stay.
 *
 * **Moving between steps is not warned about**, deliberately: the queue persists across a step
 * change and the next step drains it (FR-37's *"or step change"*), so nothing is abandoned. Leaving
 * the wizard is different only because nothing outside it drains the queue until it is reopened.
 *
 * Sign-out and organization switch are UX-37's other two triggers and are not here: sign-out lives
 * in the global tier's account corner and the switch is task 83's route. Both are recorded against
 * their owners in `architecture.md` §12.5.6.
 */
export function WizardExit() {
  const t = useTranslations('organization.wizard');
  const router = useRouter();
  const { hasUnsynced, unsynced } = useAutosaveContext();
  const [confirming, setConfirming] = useState(false);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasUnsynced) return;
    event.preventDefault();
    setConfirming(true);
  };

  return (
    <>
      <TextLink asChild>
        <Link href={ROUTES.REPORTS} onClick={onClick}>
          {t('exit')}
        </Link>
      </TextLink>
      <ConsequenceDialogue
        open={confirming}
        title={t('leave.title')}
        object={t('leave.object', { count: unsynced })}
        consequence={t('leave.consequence')}
        retained={t('leave.retained')}
        confirmLabel={t('leave.confirm')}
        cancelLabel={t('leave.cancel')}
        onConfirm={() => {
          setConfirming(false);
          router.push(ROUTES.REPORTS);
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
