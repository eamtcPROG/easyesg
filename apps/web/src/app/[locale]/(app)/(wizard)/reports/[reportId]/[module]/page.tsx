import { DISCLOSURE_STATE, type DisclosureState } from '@easyesg/contracts';
import { Banner, CALLOUT_INTENT, Callout, TextLink, WizardShell } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AutosaveBanner } from '@/features/wizard/components/autosave-banner';
import { AutosaveProvider } from '@/features/wizard/components/autosave-context';
import { ModuleRail } from '@/features/wizard/components/module-rail';
import { SaveState } from '@/features/wizard/components/save-state';
import { StepFields } from '@/features/wizard/components/step-fields';
import { WizardExit } from '@/features/wizard/components/wizard-exit';
import { READ_ONLY_CAUSE, readWizardStep, type ReadOnlyCause } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { readSession } from '@/server/session';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { periodRoute } from '@/lib/routes';

/**
 * S-07 — Report wizard, module step · RC · Wizard archetype
 *
 * **The shell is rendered by the step, not by the layout**, and that is a Next.js fact rather than a
 * preference: a layout at `[reportId]` cannot see the `[module]` segment, so a rail rendered there
 * could not mark which step is current — and `aria-current="step"` is the whole of how a
 * screen-reader user knows where they are in an ordered progression (NFR-75).
 *
 * **The fields are §6.2's anatomy bound to autosave (task 35.2)**, replacing task 35.1's list: a
 * control per kind, committing on blur with no save button (UX-34), the save-state indicator in the
 * shell's fixed location (UX-35), the unsynced banner (UX-37), and the exit control's warning when
 * something is unsent. The draft-integrity pattern is what discharges UC-35 here (UX-7, OQ-5).
 *
 * **The provider wraps the shell, not the fields.** The indicator is in the header, the banner
 * above the fields, the exit control beside the indicator — four regions of one state, and a
 * provider around any one of them would invite the rest to keep state of their own.
 *
 * States (§8.1) present: ready · error — permission · error — recoverable · **read-only**, naming
 * which of UX-13's causes applies and what restores editing · **offline / queued** · **pending —
 * async** (the indicator's *saving*) · success. Still to arrive: empty — first use and the two
 * loading states, with task 36's content; partial, with S-08 (task 42).
 */
const MESSAGES = 'organization.wizard';

type Props = { params: Promise<{ locale: string; reportId: string; module: string }> };

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function ReportModuleStepPage({ params }: Props) {
  const { reportId, module } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const [t, messages, read, session] = await Promise.all([
    getTranslations(MESSAGES),
    getMessages(),
    readWizardStep({ reportId, module }),
    readSession(),
  ]);

  if (read.status === TENANT_READ.FORBIDDEN) {
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
  // A module the pinned taxonomy does not carry is not a step. 404 rather than an empty shell, so a
  // stale deep link says so instead of rendering a wizard with nothing in it.
  if (!read.modules.some((summary) => summary.module === module)) notFound();

  const summary = read.modules.find((m) => m.module === module);
  const outstanding = summary === undefined ? 0 : summary.total - summary.answered;
  const readOnly = read.readOnly !== null;

  // Keys to words on the server, where the catalogue object can be indexed — a translator call
  // cannot take a value the API supplies (S-13's page records the same reason for legal forms).
  const markers: Record<string, string> = messages.organization.wizard.field.markers;
  const markerLabels = Object.fromEntries(
    Object.values(DISCLOSURE_STATE).map((state) => [state, markers[state] ?? '']),
  ) as Record<DisclosureState, string>;

  // The country domain is ISO 3166, which EFRAG references and does not ship, so the api serves its
  // members unnamed and says so (task 91.1). The words are this app's — S-04's country field reads
  // the same catalogue — and they are resolved here for the reason the markers above are: a
  // translator call cannot take a key the API supplies.
  const countries: Record<string, string> = messages.organization.countries;
  const fields = read.step.fields.map((field) =>
    field.options === null
      ? field
      : {
          ...field,
          options: field.options.map((option) =>
            option.label !== null || option.code === null
              ? option
              : { ...option, label: countries[option.code] ?? option.code },
          ),
        },
  );

  return (
    <NextIntlClientProvider messages={{ organization: { wizard: messages.organization.wizard } }}>
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
            readOnly={readOnly}
            markerLabels={markerLabels}
            carriedLabel={t('field.carried')}
          />
        </WizardShell>
      </AutosaveProvider>
    </NextIntlClientProvider>
  );
}

/**
 * UX-13: *"a persistent banner stating which of the three causes applies and what restores
 * editing. Three different causes shall never produce one indistinguishable read-only screen."*
 * Each cause has its own words and its own remedy — the lock's is the period record (S-14), where
 * an administrator reopens it (UC-58); a viewer's is a person who can change their role.
 */
async function ReadOnlyBanner({
  cause,
  periodHref,
}: {
  readonly cause: ReadOnlyCause;
  readonly periodHref: string;
}) {
  const t = await getTranslations(`${MESSAGES}.readOnly`);
  if (cause === READ_ONLY_CAUSE.LOCKED) {
    return (
      <Banner
        intent={CALLOUT_INTENT.INFO}
        title={t('lockedTitle')}
        action={
          <TextLink asChild>
            <Link href={periodHref}>{t('lockedAction')}</Link>
          </TextLink>
        }
      >
        {t('lockedBody')}
      </Banner>
    );
  }
  return (
    <Banner intent={CALLOUT_INTENT.INFO} title={t('viewerTitle')} action={null}>
      {t('viewerBody')}
    </Banner>
  );
}
