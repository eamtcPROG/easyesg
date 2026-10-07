import { CALLOUT_INTENT, Callout, WizardShell } from '@easyesg/ui';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getPathname } from '@/i18n/navigation';
import { readActiveMembership } from '@/server/data/memberships';
import { WIZARD_READ, readWizardStep } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { readSession } from '@/server/session/session';
import { periodRoute, reportStepRoute } from '@/lib/routes';
import { priorValuesOf } from '../../tools/comparatives';
import { labelledOptions } from '../../tools/step-words';
import { AutosaveBanner } from '../banner/autosave-banner';
import { ReadOnlyBanner } from '../banner/read-only-banner';
import { StepFields } from '../fields/section/step-fields';
import { AutosaveProvider } from '../providers/autosave-context';
import { WizardReauthentication } from '../session/wizard-reauthentication';
import { modulesInScope, moduleStateOf } from '../../tools/module-state';
import { placeOf } from '../../tools/step-place';
import { moduleLabel, moduleStatus, moduleSummary, stepStatusNote } from '../../tools/module-words';
import { StepFoot } from '../foot/step-foot';
import { ReportBar } from '../bar/report-bar';
import { ModuleRail } from '../rail/module-rail';
import { ModuleSwitcher } from '../rail/module-switcher';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

/**
 * S-07's one region: the reads, which of §8.1's arms applies, and the shell over the step (cut out
 * of the route by task 134's parent-close review; the route pins the locale and renders this).
 *
 * **The shell is rendered by the step, not by the layout**, and that is a Next.js fact rather than a
 * preference: a layout at `[reportId]` cannot see the `[module]` segment, so a rail rendered there
 * could not mark which step is current — and `aria-current="step"` is the whole of how a
 * screen-reader user knows where they are in an ordered progression (NFR-75).
 *
 * **The provider wraps the shell, not the fields.** The indicator and the exit are in the bar (task 179.1), the
 * banner above the fields — regions of one state, and a provider around any one of them would invite the rest to keep
 * state of their own.
 *
 * A module the pinned taxonomy does not carry is not a step: 404 rather than an empty shell, so a
 * stale deep link says so instead of rendering a wizard with nothing in it — and since task 179.3 neither is a module
 * the report's scope does not ask, a C module on a Basic report.
 *
 * **Since task 92 it also reads what re-authentication needs, from the session the page was rendered
 * under**: the account the queue belongs to, S-01's keep-me-signed-in choice, the organization to restore
 * on the new session (`readActiveMembership` is the global tier's `cache()`d read, so no second call), and
 * this step's own address in its locale for *sign out and finish later*. The dialogue opens only when the
 * session is gone, which is exactly when none of these could be read any more.
 */
export async function WizardStep({
  reportId,
  module,
}: {
  readonly reportId: string;
  readonly module: string;
}) {
  const [t, messages, read, session, membership, locale] = await Promise.all([
    getTranslations(WIZARD_MESSAGES),
    getMessages(),
    readWizardStep({ reportId, module }),
    readSession(),
    readActiveMembership(),
    getLocale(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('forbidden.title')} action={null}>
        {t('forbidden.body')}
      </Callout>
    );
  }
  // A module the pinned taxonomy does not carry — the api's 404 since task 183 — is the same screen as one outside the
  // report's scope, below.
  if (read.status === WIZARD_READ.MODULE_NOT_FOUND) notFound();
  if (read.status === TENANT_READ.UNREACHABLE || session === null) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={null}>
        {t('unreachable.body')}
      </Callout>
    );
  }
  // **The modules the report's scope asks, and nothing else** (task 179.3; FR-177, UX-9): a Basic report's list stops
  // at B11, and a C module's address on one is a module this report does not carry — the same 404 as one the pinned
  // taxonomy does not. Every part below reads this one list.
  const modules = modulesInScope({ modules: read.modules, scope: read.report.scope });
  const summary = modules.find((m) => m.module === module);
  if (summary === undefined) notFound();

  // The heading's state is the list's own (task 179.3): one `moduleStateOf`, so the step and its row cannot disagree.
  const state = moduleStateOf(summary);
  // Where the step stands, computed once for the heading, the stepper and the foot (`section-compute-once`).
  const place = placeOf({ modules, current: module });
  const readOnly = read.readOnly !== null;
  const fields = labelledOptions(read.step.fields, messages.organization.countries);
  // One list, drawn twice: docked at `wide`, and in the drawer below it (task 179.1).
  const rail = <ModuleRail reportId={reportId} modules={modules} current={module} />;

  return (
    <AutosaveProvider reportId={reportId} accountId={session.account.id}>
      <WizardShell
        bar={<ReportBar report={read.report} modules={modules} readOnly={read.readOnly} />}
        modulesLabel={t('rail.label')}
        modules={rail}
        compactModules={
          <ModuleSwitcher reportId={reportId} modules={modules} current={module} position={place.position}>
            {rail}
          </ModuleSwitcher>
        }
        title={moduleLabel(t, module)}
        position={t('step.position', { position: place.position, total: place.total })}
        summary={moduleSummary(t, module)}
        status={{
          state,
          words: moduleStatus(t, { summary, state }),
          note: stepStatusNote(t, { summary, state }),
        }}
        foot={<StepFoot reportId={reportId} place={place} />}
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
        <AutosaveBanner />
        <StepFields
          fields={fields}
          axes={read.step.axes}
          derivationInputs={read.step.derivationInputs}
          priorValues={priorValuesOf(read.prior)}
          readOnly={readOnly}
        />
      </WizardShell>
      <WizardReauthentication
        module={module}
        account={{ id: session.account.id, email: session.account.email, remembered: session.remembered }}
        organizationId={membership?.organizationId ?? null}
        returnTo={getPathname({ href: reportStepRoute({ reportId, module }), locale })}
      />
    </AutosaveProvider>
  );
}
