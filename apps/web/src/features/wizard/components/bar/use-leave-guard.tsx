'use client';

import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAutosaveContext } from '../providers/autosave-context';
import { useWhenSessionHeld } from '../providers/use-when-session-held';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

/**
 * Leaving the step for somewhere else in the app — the reports list, or since task 43.2 the report's preview — with
 * UX-37's question first where answers are not yet sent: they stay on this device, and appear nowhere else, the preview
 * included, until they are (task 35.2). **A hook since task 43.2**, when the bar's ⋯ at `compact` needed to leave for
 * the preview by the same rule as the bar's own links, which `ExitLink` had held alone.
 *
 * `leave` goes at once where nothing is unsent, and asks where something is; `guard` is the dialogue that asks, drawn
 * by whoever calls the hook. **The question lasts only while something is at stake**: an answer in flight at the press
 * is unsent, and once the queue drains the reader goes where they asked. Until task 43.2 the dialogue stayed open
 * over *0 changes have not been sent yet*, found by S-10's journey leaving B1 as its record values were sent.
 */
export function useLeaveGuard(): { readonly leave: (href: string) => void; readonly guard: ReactNode } {
  const t = useTranslations(WIZARD_MESSAGES);
  const router = useRouter();
  const { hasUnsynced, unsynced } = useAutosaveContext();
  const whenSessionHeld = useWhenSessionHeld();
  // Where the reader asked to go, while the dialogue asks them; `null` while it is not open.
  const [asked, setAsked] = useState<string | null>(null);

  const leave = (href: string) =>
    whenSessionHeld(() => {
      if (hasUnsynced) setAsked(href);
      else router.push(href);
    });

  // Nothing unsent any more while the question was open: go, rather than ask about nothing.
  useEffect(() => {
    if (asked !== null && !hasUnsynced) router.push(asked);
  }, [asked, hasUnsynced, router]);

  const guard = (
    <ConsequenceDialogue
      open={asked !== null && hasUnsynced}
      title={t('leave.title')}
      object={t('leave.object', { count: unsynced })}
      consequence={t('leave.consequence')}
      retained={t('leave.retained')}
      confirmLabel={t('leave.confirm')}
      cancelLabel={t('leave.cancel')}
      onConfirm={() => {
        setAsked(null);
        if (asked !== null) router.push(asked);
      }}
      onCancel={() => setAsked(null)}
    />
  );

  return { leave, guard };
}
