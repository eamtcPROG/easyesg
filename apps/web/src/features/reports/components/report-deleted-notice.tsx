import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { DELETION_NOTICE, DELETION_NOTICE_PARAM } from '@/lib/routes';

/**
 * S-06 after a deletion (task 192; `architecture.md` §12.5.6's task-192 row (f)) — the address's `deleted` value, said
 * in a fixed sentence as S-05's arrival is, whether the report was deleted here or from S-07, which lands here. A value
 * it does not recognise says nothing. The list's own view writer drops the parameter, so the sentence goes with the
 * reader's next change of view.
 */
export async function ReportDeletedNotice({
  query,
}: {
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
}) {
  if (query[DELETION_NOTICE_PARAM] !== DELETION_NOTICE.REPORT) return null;
  const t = await getTranslations('organization.reports.deleted');
  return (
    <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
