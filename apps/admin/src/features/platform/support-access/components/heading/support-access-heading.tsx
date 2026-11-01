import { useTranslations } from 'use-intl';

/**
 * A-07's heading (task 67.9): what the screen is for, in the sentence that makes it evident the access is observed
 * and the organization's to give (UX-124; FR-78 as amended).
 */
export function SupportAccessHeading() {
  const t = useTranslations('platform.supportAccess');

  return (
    <header className="flex flex-col gap-[var(--space-2)]">
      <h1 className="t-heading-1">{t('title')}</h1>
      <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
    </header>
  );
}
