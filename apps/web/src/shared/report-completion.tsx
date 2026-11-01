import type { ReportValidationSummary } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import styles from './report-completion.module.css';

/** The words S-05's and S-06's completion share, read by this component alone. */
const COMPLETION_MESSAGES = 'organization.completion' as const;

/**
 * **A report's completion as a list shows it** (task 42.2; FR-23 AC-7, FR-25 AC-3; `architecture.md` §12.5.6's task-42
 * row (f)) — the last run's *7 of 11 modules complete*, a bar drawing that share, and what it left outstanding; or
 * *not checked yet* where no run has made a count. **Never a percentage** (182/18): the bar draws the share, the words
 * state the counts.
 *
 * **In `shared/` because two screens draw it** — S-06's completion column and S-05's filing row — and one wording of
 * one roll-up is what keeps the two lists from disagreeing. **No directive and no async**: S-06 draws it inside a
 * Client Component's cell, S-05 inside a Server Component, and it reads its own words in either (task 158).
 */
export function ReportCompletion({ validation }: { readonly validation: ReportValidationSummary | null }) {
  const t = useTranslations(COMPLETION_MESSAGES);
  if (validation === null) return <span className={styles.unchecked}>{t('unchecked')}</span>;
  const { modulesComplete, modulesCounted, outstanding } = validation;
  return (
    <span className={styles.completion}>
      <span className={styles.bar} aria-hidden="true">
        {modulesCounted > 0 ? (
          // The share drawn, never printed — a proportion of the bar's own width.
          <span className={styles.done} style={{ inlineSize: `${(modulesComplete / modulesCounted) * 100}%` }} />
        ) : null}
      </span>
      <span className={styles.words}>
        {/* Its own element, as the outstanding count beside it is: one sentence, readable and findable as one. */}
        <span>{t('modules', { done: modulesComplete, counted: modulesCounted })}</span>
        {outstanding > 0 ? <span className={styles.outstanding}>{t('outstanding', { count: outstanding })}</span> : null}
      </span>
    </span>
  );
}
