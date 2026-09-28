'use client';

import { Spinner } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ACCESS_PANEL } from '../../../tools/access-panel';
import { AccessDialog } from '../../shared/access-dialog';
import { REMIND_MESSAGES } from '../shared/remind-messages';

/**
 * The reminder's *loading — initial* (task 50.3; §8.1): its two reads have not answered yet. **Seen only when the
 * address opens the reminder before they have** — a reload or a pasted link, or a press faster than the stream — since
 * a closed dialogue draws nothing, and the list above never waited on these reads. The dialogue's frame and title, and
 * a status naming what is awaited, so nothing moves when the arm arrives in its place.
 *
 * A client part since the reminder became a dialogue (28 Sep 2026): whether it is open is the address's, which the
 * provider reads in the browser. It awaits nothing (`apps/web/CLAUDE.md`'s fallback rule).
 */
export function RemindLoading() {
  const t = useTranslations(REMIND_MESSAGES);

  return (
    <AccessDialog panel={ACCESS_PANEL.REMIND} title={t('heading')}>
      <p className="t-body" role="status">
        <Spinner /> {t('loading')}
      </p>
    </AccessDialog>
  );
}
