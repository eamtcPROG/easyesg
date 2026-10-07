'use client';

import { CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * What an import did, once it is done (task 204.2; FR-211): how many lines were added and from which file, on the
 * board where the panel was — the lines themselves may be at a site the chips are not showing. §8.1's expiring
 * message, because it reports the reporter's own act: it leaves after its dwell or when closed, and the board stops
 * rendering it when the next panel opens. The lines are already on screen and in the queue; this stores nothing.
 */
export function ImportDone({
  lines,
  file,
  onDismiss,
}: {
  readonly lines: number;
  readonly file: string;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  return (
    <ExpiringCallout
      intent={CALLOUT_INTENT.SUCCESS}
      title={t('done.title', { lines, file })}
      action={null}
      dismissLabel={t('done.dismiss')}
      onDismiss={onDismiss}
    >
      {t('done.body')}
    </ExpiringCallout>
  );
}
