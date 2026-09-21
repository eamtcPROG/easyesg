import { CALLOUT_INTENT, Callout, WizardShell } from '@easyesg/ui';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getPathname } from '@/i18n/navigation';
import { readActiveMembership } from '@/server/data/memberships';
import { readWizardStep } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { readSession } from '@/server/session/session';
import { redirectToSignIn } from '@/server/session/sign-in-redirect';
import { periodRoute, reportStepRoute } from '@/lib/routes';
import { priorValuesOf } from '../../tools/comparatives';
import { labelledOptions } from '../../tools/step-words';
import { AutosaveBanner } from '../banner/autosave-banner';
import { ReadOnlyBanner } from '../banner/read-only-banner';
import { StepFields } from '../fields/section/step-fields';
import { AutosaveProvider } from '../providers/autosave-context';
import { WizardReauthentication } from '../session/wizard-reauthentication';
import { ModuleRail } from '../shell/module-rail';
import { SaveState } from '../shell/save-state';
import { WizardExit } from '../shell/wizard-exit';
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
 * **The provider wraps the shell, not the fields.** The indicator is in the header, the banner
 * above the fields, the exit control beside the indicator — four regions of one state, and a
 * provider around any one of them would invite the rest to keep state of their own.
 *
 * A module the pinned taxonomy does not carry is not a step: 404 rather than an empty shell, so a
 * stale deep link says so instead of rendering a wizard with nothing in it.
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

  // Task 160: the api has ended the session this browser still names — sign in, and back to this step.
  // Not UX-38's dialogue: nothing is in hand on a render, and answers queued before it wait in the
  // account-keyed store for the step to load again (task 92's row sends a reload the same way).
  if (read.status === TENANT_READ.SIGNED_OUT) return redirectToSignIn();
  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
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
  if (!read.modules.some((summary) => summary.module === module)) notFound();

  const summary = read.modules.find((m) => m.module === module);
  const outstanding = summary === undefined ? 0 : summary.total - summary.answered;
  const readOnly = read.readOnly !== null;
  const fields = labelledOptions(read.step.fields, messages.organization.countries);

  return (
    <AutosaveProvider reportId={reportId} accountId={session.account.id}>
      <WizardShell
        modulesLabel={t('rail.label')}
        modules={
          <ModuleRail
            reportId={reportId}
            modules={read.modules}
            current={module}
            answeredLabel={(m) => t('rail.answered', { answered: m.answered, total: m.total })}
            inapplicableLabel={t('rail.inapplicable')}
            omittedLabel={t('rail.omitted')}
          />
        }
        title={t('step.title', { module })}
        progress={t('step.outstanding', { count: outstanding })}
        saveState={readOnly ? null : <SaveState />}
        exit={<WizardExit />}
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
