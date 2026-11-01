import type { Report } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, WizardBar } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { reportIdentity } from '@/features/wizard/tools/report-identity';
import { Link } from '@/i18n/navigation';
import { reportExportRoute, reportRoute } from '@/lib/routes';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';

/**
 * S-10's bar (task 43.2) — S-07's, naming the report as S-07's does, with its way back to the step the reader came from
 * and S-10's one way on, *proceed to export*, which opens S-11 (task 47.3).
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
      actions={
        <Button asChild variant={BUTTON_VARIANT.PRIMARY}>
          <Link href={reportExportRoute({ reportId: report.id })}>{tWizard('bar.export')}</Link>
        </Button>
      }
    />
  );
}
