'use client';

import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAccess } from '../../shared/access-context';
import { REMIND_MESSAGES } from '../shared/remind-messages';

/**
 * The reminder panel where the sender is the organization's only active member (task 50.3): no one to remind, and
 * the way on is the invite panel above — its heading is the screen's own anchor, as the list's first-use state uses.
 */
export function NoOneToRemind() {
  const t = useTranslations(`${REMIND_MESSAGES}.noOne`);
  const { inviteAnchorId } = useAccess();

  return (
    <p className="t-body">
      {t('body')} <TextLink href={`#${inviteAnchorId}`}>{t('action')}</TextLink>
    </p>
  );
}
