import type { Report, SupersedingPin } from '@easyesg/contracts';
import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';

/**
 * UX-48's notice (task 47.3; FR-51): the report is pinned to a version a new report would no longer pin. It says the
 * platform runs migrations and tells organizations when, and that the file is made under the report's own version —
 * the export against the original version is what the dialogue below offers now (182/35). **No migration is offered
 * here**: the reporter runs none (`architecture.md` §12.5.6's task-47 row (6)).
 */
export async function SupersededNotice({
  report,
  supersededBy,
}: {
  readonly report: Report;
  readonly supersededBy: SupersedingPin;
}) {
  const t = await getTranslations(EXPORTS_MESSAGES);
  return (
    <Callout intent={CALLOUT_INTENT.INFO} title={t('dialogue.superseded.title')} action={null}>
      {t('dialogue.superseded.body', { pinned: report.taxonomyVersion, current: supersededBy.taxonomyVersion })}
    </Callout>
  );
}
