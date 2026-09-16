'use client';

import { useTranslations } from 'next-intl';
import { ReauthenticationDialogue } from '@/features/identity/reauthenticate/components/reauthentication-dialogue';
import type { ReauthenticatingAccount } from '@/features/identity/reauthenticate/tools/reauthentication-command';
import { SESSION_STANDING } from '@/lib/session-standing';
import { useAutosaveContext } from '../providers/autosave-context';

/**
 * S-07's half of UX-38 (task 92): the re-authentication dialogue, open for exactly as long as autosave's
 * state says the session has ended, over the step the reader is on.
 *
 * **The wizard supplies what only it knows.** Which step was open, and whether anything is waiting to be
 * sent — the artboard's *"nothing was lost"*, stated as how many changes this device is holding rather
 * than when the last one saved (`architecture.md` §12.5.6's task-92 row), and with the memory fallback's
 * caveat where signing out would lose them. Resuming tells autosave, and the queue drains.
 *
 * The account, the organization and the return path are read by the step's section on the server, from
 * the session the page was rendered under.
 */
export function WizardReauthentication({
  module,
  account,
  organizationId,
  returnTo,
}: {
  readonly module: string;
  readonly account: ReauthenticatingAccount;
  readonly organizationId: string | null;
  readonly returnTo: string;
}) {
  const t = useTranslations('organization.wizard.session');
  const { state, unsynced, durable, resume } = useAutosaveContext();

  const sentences = [
    t('expired', { module }),
    unsynced === 0 ? t('nothingWaiting') : t('waiting', { count: unsynced }),
    ...(unsynced === 0 || durable ? [] : [t('notDurable')]),
  ];

  return (
    <ReauthenticationDialogue
      open={state.session === SESSION_STANDING.ENDED}
      account={account}
      organizationId={organizationId}
      explanation={sentences.join(' ')}
      returnTo={returnTo}
      onResumed={resume}
    />
  );
}
