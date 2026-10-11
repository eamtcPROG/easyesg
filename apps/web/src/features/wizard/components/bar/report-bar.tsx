import type { DisclosureModuleSummary, Report } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, WizardBar } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ROUTES, reportExportRoute, reportPreviewRoute } from '@/lib/routes';
import type { ReadOnlyCause } from '@/server/data/wizard';
import { reportIdentity } from '../../tools/report-identity';
import { initialSavedAt } from '../../tools/saved-at';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import { ExitLink } from './exit-link';
import { ReportOverflow } from './report-overflow';
import { SaveState } from './save-state';

/**
 * S-07's bar — `EasyESG Reporting Screens.dc.html`'s, in the workspace tier's place (task 179.1; `design_spec.md`
 * S-07's amendment of 30 Sep 2026).
 *
 * **What is open, from the report the step was read with**: *VSME 2025 — Basic Module* from its year and scope, then
 * the company, the period and its standing — the company although the artboard omits it, since the band names the
 * organization and an organization holds several companies. **The standing is S-06's word**, read from that list's
 * own keys, so one state has one name across the two screens.
 *
 * **The period is two legal dates formatted as a range**, through `calendarDay` and the `calendar` format — a UTC pair
 * — so *31 December* is never printed as the 30th in a zone west of UTC, and the shared year is said once.
 *
 * **The save state is absent where nothing can be saved** (a read-only report, UX-13), as it was in the heading.
 */
export async function ReportBar({
  report,
  modules,
  readOnly,
}: {
  readonly report: Report;
  readonly modules: readonly DisclosureModuleSummary[];
  readonly readOnly: ReadOnlyCause | null;
}) {
  const [t, tReports, format] = await Promise.all([
    getTranslations(WIZARD_MESSAGES),
    getTranslations('organization.reports'),
    getFormatter(),
  ]);
  const { title, meta } = reportIdentity({ report, t, tReports, format });

  return (
    <WizardBar
      back={{ href: ROUTES.REPORTS, label: t('exit') }}
      linkComponent={ExitLink}
      title={title}
      meta={meta}
      saveState={readOnly === null ? <SaveState initialSavedAt={initialSavedAt(modules)} /> : null}
      actions={
        <>
          {/* S-11 (task 47.3) and S-10 (task 43.2), each left by the exit's own rule: an answer not yet sent is in no
              file and no preview until it is. */}
          <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
            <ExitLink href={reportExportRoute({ reportId: report.id })}>{t('bar.export')}</ExitLink>
          </Button>
          <Button asChild variant={BUTTON_VARIANT.PRIMARY}>
            <ExitLink href={reportPreviewRoute({ reportId: report.id })}>{t('bar.review')}</ExitLink>
          </Button>
        </>
      }
      overflow={<ReportOverflow reportId={report.id} />}
    />
  );
}
