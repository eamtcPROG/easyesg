'use client';

import { TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { REMIND_MESSAGES } from '../shared/remind-messages';

/**
 * The reminder panel with no open report (task 50.3): a reminder is about one, so there is nothing to remind about,
 * and the way on is the reports — where a period's report is started.
 */
export function NoOpenReport() {
  const t = useTranslations(`${REMIND_MESSAGES}.noReport`);

  return (
    <p className="t-body">
      {t('body')}{' '}
      <TextLink asChild>
        <Link href={ROUTES.REPORTS}>{t('action')}</Link>
      </TextLink>
    </p>
  );
}
