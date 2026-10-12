import { STATUS_TONE as STATUS_TONE_VALUES, StatusChip, type StatusTone } from '@easyesg/ui';
import { REPORT_STATUS, type ReportStatus } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { calendarDay } from '@/lib/legal-date';
import type { ReportRow } from '../tools/reports';
import { REPORTS_MESSAGES } from './reports-messages';
import styles from './reports.module.css';

/**
 * The tone says **what this row asks of the reader**, which is `StatusTone`'s own vocabulary read
 * literally rather than a severity scale.
 *
 * `open` is *neutral* — the ordinary state of most rows, and the one the label already names.
 * `ready_to_file` is *pending*: the work here is done and what resolves it is an act outside this
 * screen (task 47's export, then the filing itself), which is exactly what that member means.
 * `filed` is *positive* — settled and good, the end the whole product is for. `locked` is *neutral*
 * for `PeriodsList`'s stated reason: locking is a deliberate act that gives the change history a
 * defensible endpoint, and an alarming tone would tell a reader who did the right thing that they
 * had erred. Two rows share *neutral* and are told apart by their labels, which is UX-102 working
 * as intended — colour is never the sole carrier.
 *
 * Exhaustive by `Record`: a fifth status added to the contract fails here rather than rendering a
 * row with no chip.
 */
const STATUS_TONE: Record<ReportStatus, StatusTone> = {
  [REPORT_STATUS.OPEN]: STATUS_TONE_VALUES.NEUTRAL,
  [REPORT_STATUS.READY_TO_FILE]: STATUS_TONE_VALUES.PENDING,
  [REPORT_STATUS.LOCKED]: STATUS_TONE_VALUES.NEUTRAL,
  [REPORT_STATUS.FILED]: STATUS_TONE_VALUES.POSITIVE,
};

/**
 * S-06's status cell. **A filed row says when, and how many files** (task 216; `architecture.md` §12.5.6's task-216 row
 * (2), (3)): its chip names the filed-on date the mark records, worded as S-11's filed mark is, and the count of
 * completed exports sits beneath it, as the artboard's *Filed 19 May 2026* over *2 exports*. Every other row is its
 * status's word alone. The count is every member's — a fact of the report, as `exported` is — and the file is not.
 */
export function ReportState({ row }: { readonly row: ReportRow }) {
  const t = useTranslations(REPORTS_MESSAGES);
  const format = useFormatter();
  const tone = STATUS_TONE[row.status];

  if (row.filed === null) return <StatusChip tone={tone}>{t(`status.${row.status}`)}</StatusChip>;

  return (
    <span className={styles.state}>
      <StatusChip tone={tone}>
        {t('filed.chip', { date: format.dateTime(calendarDay(row.filed.filedOn), 'calendar') })}
      </StatusChip>
      <span className="t-caption">{t('filed.files', { count: row.filed.files })}</span>
    </span>
  );
}
