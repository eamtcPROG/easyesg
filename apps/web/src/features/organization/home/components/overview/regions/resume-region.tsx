import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { resumableRow, type OverviewRow } from '../../../tools/overview';
import { OverviewRegion } from '../shared/overview-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * UX-6's second question — *where did I leave off* (UC-67).
 *
 * **A sentence and a link, deliberately not a fourth copy of the row.** UX-6 says a single-entity
 * organization *"reduces to one resumable report and its completion state"* — one thing, not the
 * same row drawn three times, which is what a `FilingList` here would produce on the commonest shape
 * in the product. The three regions answer three questions and each takes the shape its own question
 * has.
 *
 * **It decides for itself whether to render, and that reverses what this docblock said in the same
 * task's first draft** (task 125, project owner's review). That draft took a non-null `ResumableRow`
 * so the section held
 * the conditional, on the argument that a decision made here is invisible to a reader of the file
 * that composes the screen. The owner's case is better: a region owns its question end to end, the
 * three now read as three identical lines, and adding a fourth costs one. What that argument gave up
 * — one line of visibility in the section — is smaller than what it cost, which was `resumableRow`
 * living apart from the only region that asks it.
 *
 * The behaviour is unchanged and is still UX-6's: **no row, no box.** A region headed *where did I
 * leave off* over an empty panel answers a question nobody asked, and UX-6 orders three questions
 * rather than requiring three boxes — so this returns `null` rather than an empty `OverviewRegion`.
 *
 * **It takes rows, not the read**, for the reason its two siblings do: `resumableRow` is a pure
 * selector over rows that are already dated, and the clock stays in `overview-section.tsx`.
 */
export async function ResumeRegion({ rows }: { readonly rows: readonly OverviewRow[] }) {
  const row = resumableRow(rows);
  if (row === null) return null;

  const t = await getTranslations(OVERVIEW_MESSAGES);

  return (
    <OverviewRegion heading={t('resume.heading')}>
      <p className={`t-body ${styles.lede}`}>
        {t('resume.body', {
          entity: row.entityName,
          // **A string, because ICU formats a bare number.** `2026` passed as a number renders as
          // "2 026" in `ro`/`ru` and "2,026" in `en` — the space thousands separator §11 asks for
          // everywhere else, in the one place it is wrong. `i18n/formats.ts`'s `year` format records
          // the same trap; here the value never leaves the message.
          year: String(row.fiscalYear),
        })}
      </p>
      <TextLink asChild>
        <Link href={reportRoute(row.reportId)}>{t('resume.action')}</Link>
      </TextLink>
    </OverviewRegion>
  );
}
