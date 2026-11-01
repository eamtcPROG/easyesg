import type { Report } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, WizardBar } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { reportIdentity } from '@/features/wizard/tools/report-identity';
import { Link } from '@/i18n/navigation';
import { reportPreviewRoute, reportRoute } from '@/lib/routes';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';

/**
 * S-11's bar (task 47.3) — S-07's, naming the report as S-07's and S-10's do, with the way back to the report and the
 * way to its preview (the screen's exits: S-07 and S-10).
 */
export async function ExportsBar({ report }: { readonly report: Report }) {
  const [t, tWizard, tReports, format] = await Promise.all([
    getTranslations(EXPORTS_MESSAGES),
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
        <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
          <Link href={reportPreviewRoute({ reportId: report.id })}>{t('review')}</Link>
        </Button>
      }
    />
  );
}
