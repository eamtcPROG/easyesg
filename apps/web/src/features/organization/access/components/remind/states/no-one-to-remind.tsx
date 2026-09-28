'use client';

import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../shared/remind-messages';

/**
 * The reminder panel where the sender is the organization's only active member (task 50.3): no one to remind, and
 * the way on is an invitation — the dialogue the filter row's button opens, opened from here as the list's first-use
 * state opens it (28 Sep 2026; it had been an anchor to the invite panel's heading).
 *
 * A link's look on a button: it sits inside a sentence, and it acts on this page rather than leaving it.
 */
export function NoOneToRemind() {
  const t = useTranslations(`${REMIND_MESSAGES}.noOne`);
  const { openInvite } = useAccess();

  return (
    <p className="t-body">
      {t('body')}{' '}
      <TextLink asChild>
        <button type="button" onClick={openInvite}>
          {t('action')}
        </button>
      </TextLink>
    </p>
  );
}
