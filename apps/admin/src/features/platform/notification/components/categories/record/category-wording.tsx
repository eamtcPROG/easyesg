import type { CategoryWording as Wording } from '@easyesg/contracts';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

/**
 * A-17's wording, per language and read-only (task 67.10; §5.2 A-17 as amended by OQ-43) — each channel's words as a
 * recipient reads them, **rendered with example values** (§12.5.6's task-67.10 row (1)), so an operator sees what a
 * change of channel or classification affects without reading a placeholder. **Every language, not only the
 * console's**: a channel published is published in all three, and the one missing is the one to see.
 *
 * The body keeps its line breaks, since an email is plain text (UX-66) and its paragraphs are its structure.
 */
export function CategoryWording({ wording }: { readonly wording: readonly Wording[] }) {
  const t = useTranslations('platform.notificationCategories.wording');
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-3)]">
      <h3 id={titleId} className="t-body-strong">
        {t('title')}
      </h3>
      <p className="t-caption text-[var(--text-muted)]">{t('lede')}</p>

      {wording.map((entry) => (
        <section
          key={entry.locale}
          aria-label={t(`locales.${entry.locale}`)}
          className="flex flex-col gap-[var(--space-2)] border-t border-[var(--border-subtle)] pt-[var(--space-3)]"
        >
          <h4 className="t-label">{t(`locales.${entry.locale}`)}</h4>
          <dl className="t-body grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
            <dt className="text-[var(--text-muted)]">{t('email')}</dt>
            <dd>
              {entry.email === undefined ? (
                t('none')
              ) : (
                <div className="flex flex-col gap-[var(--space-1)]">
                  <span className="t-body-strong">{entry.email.subject}</span>
                  <span className="whitespace-pre-line">{entry.email.body}</span>
                </div>
              )}
            </dd>

            <dt className="text-[var(--text-muted)]">{t('inApp')}</dt>
            <dd>
              {entry.inApp === undefined ? (
                t('none')
              ) : (
                <div className="flex flex-col gap-[var(--space-1)]">
                  <span className="t-body-strong">{entry.inApp.title}</span>
                  <span>{entry.inApp.body}</span>
                  {entry.inApp.action === undefined ? null : (
                    <span className="t-caption text-[var(--text-muted)]">
                      {t('action', { action: entry.inApp.action })}
                    </span>
                  )}
                </div>
              )}
            </dd>
          </dl>
        </section>
      ))}
    </section>
  );
}
