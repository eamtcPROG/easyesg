import type { Report } from '@easyesg/contracts';
import { WizardBar } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { reportIdentity } from '@/features/wizard/tools/report-identity';
import { Link } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { MIGRATION_MESSAGES } from './migration-messages';

/** S-49's bar (task 67.20) — S-07's, naming the report as S-11's does, with the way back to it (the screen's exit). */
export async function MigrationBar({ report }: { readonly report: Report }) {
  const [t, tWizard, tReports, format] = await Promise.all([
    getTranslations(MIGRATION_MESSAGES),
    getTranslations(WIZARD_MESSAGES),
    getTranslations('organization.reports'),
    getFormatter(),
  ]);
  const { title, meta } = reportIdentity({ report, t: tWizard, tReports, format });
  return <WizardBar back={{ href: reportRoute(report.id), label: t('back') }} linkComponent={Link} title={title} meta={meta} />;
}
