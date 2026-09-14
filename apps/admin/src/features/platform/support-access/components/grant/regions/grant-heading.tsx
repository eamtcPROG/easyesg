import type { SupportAccessLogEntry } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'use-intl';
import { GrantCountdown } from '../../shared/grant-countdown';

/**
 * Above the organization's reports (task 67.9; UX-124): whose they are, when the grant ends with its countdown, and
 * the sentence that makes it evident the reading is observed — the organization sees it and can end it.
 */
export function GrantHeading({
  entry,
  expiresAt,
  onClose,
}: {
  readonly entry: SupportAccessLogEntry;
  readonly expiresAt: number;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.supportAccess');
  const format = useFormatter();

  return (
    <header className="flex flex-col gap-[var(--space-2)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <h2 className="t-heading-3">
          {t('grant.title', { organization: entry.organizationName ?? t('log.deletedOrganization') })}
        </h2>
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('grant.close')}
        </Button>
      </div>
      <p className="t-body flex flex-wrap gap-x-[var(--space-2)]">
        <span>{t('inProgress.active', { time: format.dateTime(expiresAt, 'stamp') })}</span>
        <GrantCountdown expiresAt={expiresAt} />
      </p>
      <p className="t-body text-[var(--text-muted)]">{t('grant.lede')}</p>
      <p className="t-body text-[var(--text-muted)]">{t('grant.observed')}</p>
    </header>
  );
}
