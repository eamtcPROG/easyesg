import type { Report } from '@easyesg/contracts';
import { WizardBar } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PendingAction } from '@/features/wizard/components/bar/pending-action';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { BAR_ACTION } from '@/features/wizard/tools/bar-actions';
import { reportIdentity } from '@/features/wizard/tools/report-identity';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';

/**
 * S-10's bar (task 43.2) — S-07's, naming the report as S-07's does, with its way back to the step the reader came from
 * and S-10's one way on, *proceed to export*, drawn ahead of S-11 as S-07 draws it (task 47.3 builds the dialogue).
 */
export async function PreviewBar({ report }: { readonly report: Report }) {
  const [t, tWizard, tReports, format] = await Promise.all([
    getTranslations(PREVIEW_MESSAGES),
    getTranslations(WIZARD_MESSAGES),
    getTranslations('organization.reports'),
    getFormatter(),
  ]);
  const { title, meta } = reportIdentity({ report, t: tWizard, tReports, format });
  return (
    <WizardBar
      back={{ href: reportRoute(report.id), label: t('back') }}
      linkComponent={Link}
      title={title}
      meta={meta}
      actions={<PendingAction action={BAR_ACTION.EXPORT} />}
    />
  );
}
