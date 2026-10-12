import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { exportFileAddress } from '@/client/exports/read-export';
import type { ReportRow } from '../tools/reports';
import { REPORTS_MESSAGES } from './reports-messages';

/**
 * A filed row's *Download* (task 216; FR-53's behaviour 8; `architecture.md` §12.5.6's task-216 row (1)): the export
 * completed last, whatever its format and language, through the session pass-through, which forwards the file's own
 * name — the stored bytes, never regenerated. **A link, never a fetch**, as S-11's history is: the browser saves it.
 *
 * **Named for its report** (row (e)): every filed row's visible label is the same word, and a screen reader listing the
 * page's links would otherwise read a column of *Download*s that name nothing.
 */
export function ReportDownload({ row, exportId }: { readonly row: ReportRow; readonly exportId: string }) {
  const t = useTranslations(REPORTS_MESSAGES);

  return (
    <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
      <a
        href={exportFileAddress(exportId)}
        download
        // The year as a string: ICU formats a number argument with grouping, which makes 2026 *2 026* (`i18n/formats.ts`).
        aria-label={t('filed.downloadLabel', { entity: row.entityName, year: String(row.fiscalYear) })}
      >
        {t('filed.download')}
      </a>
    </Button>
  );
}
