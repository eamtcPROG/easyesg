import { CALLOUT_INTENT, Callout, WizardShell } from '@easyesg/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getPathname } from '@/i18n/navigation';
import { periodRoute, reportCalculatorRoute } from '@/lib/routes';
import { readCalculator } from '@/server/data/calculator';
import { readActiveMembership } from '@/server/data/memberships';
import { TENANT_READ } from '@/server/data/tenant-read';
import { readSession } from '@/server/session/session';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { AutosaveBanner } from '@/features/wizard/components/banner/autosave-banner';
import { ReadOnlyBanner } from '@/features/wizard/components/banner/read-only-banner';
import { ReportBar } from '@/features/wizard/components/bar/report-bar';
import { AutosaveProvider } from '@/features/wizard/components/providers/autosave-context';
import { ModuleRail } from '@/features/wizard/components/rail/module-rail';
import { ModuleSwitcher } from '@/features/wizard/components/rail/module-switcher';
import { WizardReauthentication } from '@/features/wizard/components/session/wizard-reauthentication';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { modulesInScope } from '@/features/wizard/tools/module-state';
import { moduleLabel } from '@/features/wizard/tools/module-words';
import { placeOf } from '@/features/wizard/tools/step-place';
import { CALCULATOR_MODULE } from '../../tools/calculator-module';
import { openLine } from '../../tools/open-line';
import { shownSite } from '../../tools/shown-site';
import { CalculatorBoard } from '../board/calculator-board';
import { CalculatorSummary } from '../summary/calculator-summary';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { NoFactorSet } from '../states/no-factor-set';
import { NoSites } from '../states/no-sites';
import { CalculatorCrumb } from './calculator-crumb';
import { CalculatorFoot } from './calculator-foot';

/**
 * S-09's one region: the reads, which of §8.1's arms applies, and the wizard shell around the calculator (task 39.1;
 * UC-32; `design_spec.md` S-09).
 *
 * **A composition of S-07, not a screen of its own** (§4.6, OQ-7): the same bar, the same rail with B3 marked, the same
 * autosave provider and indicator and banner, the same re-authentication over the work — so a line entered here is in
 * the one queue the wizard's fields use (§12.5.6's task-39 row (2)), the bar's indicator counts it, and an organization
 * switch or a sign-out sends it first. The heading says where the reader is — *B3 › Carbon calculator* — and both ways
 * back lead to B3, never to the top of the report (§4.7).
 *
 * **Three arms before the board** (§8.1): no factor set serves the period, so nothing can be written — the lines
 * already entered are still shown, read-only, because UX-41 keeps them on screen as the record they are; no site in
 * B1, which FR-33 makes a precondition; and the board itself, whose empty state is its own.
 */
export async function CalculatorStep({
  reportId,
  site,
  line,
}: {
  readonly reportId: string;
  /** `?site=` as the route received it. */
  readonly site: string | readonly string[] | undefined;
  /** `?line=` as the route received it — the line whose derivation is open (task 39.2). */
  readonly line: string | readonly string[] | undefined;
}) {
  const [t, tWizard, read, session, membership, locale] = await Promise.all([
    getTranslations(CALCULATOR_MESSAGES),
    getTranslations(WIZARD_MESSAGES),
    readCalculator(reportId),
    readSession(),
    readActiveMembership(),
    getLocale(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    await redirectToChoiceIfOwed();
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('forbidden.title')} action={null}>
        {t('forbidden.body')}
      </Callout>
    );
  }
  if (read.status === TENANT_READ.UNREACHABLE || session === null) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={null}>
        {t('unreachable.body')}
      </Callout>
    );
  }

  const modules = modulesInScope({ modules: read.modules, scope: read.report.scope });
  // A report whose taxonomy carries no B3 has no calculator to open — the 404 a stale link to one deserves.
  if (!modules.some((summary) => summary.module === CALCULATOR_MODULE)) notFound();

  const place = placeOf({ modules, current: CALCULATOR_MODULE });
  const { calculator } = read;
  // Nothing can be written without a set to check a line against (the writes refuse), so the lines are a record then.
  const readOnly = read.readOnly !== null || calculator.factorSet === null;
  const rail = <ModuleRail reportId={reportId} modules={modules} current={CALCULATOR_MODULE} />;
  const b3 = moduleLabel(tWizard, CALCULATOR_MODULE);

  return (
    <AutosaveProvider reportId={reportId} accountId={session.account.id}>
      <WizardShell
        bar={<ReportBar report={read.report} modules={modules} readOnly={read.readOnly} />}
        modulesLabel={tWizard('rail.label')}
        modules={rail}
        compactModules={
          <ModuleSwitcher reportId={reportId} modules={modules} current={CALCULATOR_MODULE} position={place.position}>
            {rail}
          </ModuleSwitcher>
        }
        position={<CalculatorCrumb reportId={reportId} module={b3} />}
        title={t('heading')}
        summary={t('lede')}
        // *What goes back to B3* (task 39.2), docked beside the lines at `wide` as the artboard draws it.
        panel={
          calculator.sites.length === 0 ? undefined : (
            <CalculatorSummary reportId={reportId} initial={calculator} readOnly={readOnly} />
          )
        }
        foot={<CalculatorFoot reportId={reportId} module={b3} />}
      >
        {read.readOnly === null ? null : (
          <ReadOnlyBanner
            cause={read.readOnly}
            periodHref={periodRoute({
              entityId: read.report.subject.reportingEntityId,
              periodId: read.report.reportingPeriodId,
            })}
          />
        )}
        {calculator.factorSet === null ? <NoFactorSet /> : null}
        <AutosaveBanner />
        {calculator.sites.length === 0 ? (
          <NoSites reportId={reportId} />
        ) : (
          <CalculatorBoard
            reportId={reportId}
            initial={calculator}
            shownSite={shownSite({ param: site, sites: calculator.sites })}
            openLine={openLine(line)}
            readOnly={readOnly}
          />
        )}
      </WizardShell>
      <WizardReauthentication
        module={CALCULATOR_MODULE}
        account={{ id: session.account.id, email: session.account.email, remembered: session.remembered }}
        organizationId={membership?.organizationId ?? null}
        returnTo={getPathname({ href: reportCalculatorRoute({ reportId }), locale })}
      />
    </AutosaveProvider>
  );
}
