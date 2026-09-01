import { CALLOUT_INTENT, Callout, TextLink, WizardShell } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ModuleRail } from '@/features/wizard/components/module-rail';
import styles from '@/features/wizard/components/module-rail.module.css';
import { readWizardStep } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';

/**
 * S-07 — Report wizard, module step · RC · Wizard archetype
 *
 * **The shell is rendered by the step, not by the layout**, and that is a Next.js fact rather than a
 * preference: a layout at `[reportId]` cannot see the `[module]` segment, so a rail rendered there
 * could not mark which step is current — and `aria-current="step"` is the whole of how a
 * screen-reader user knows where they are in an ordered progression (NFR-75).
 *
 * **What this task delivers is navigation.** The fields are listed with their labels and whatever
 * has been answered; the inputs — the disclosure field anatomy, its units, its not-available and
 * not-material affordances — are **task 36.1's**, and replacing this list is that task's first act.
 * Listing them is what keeps the step from being the dead screen task 30.1 ruled against.
 *
 * States (§8.1) present here: ready · error — permission · error — recoverable. The remaining eight
 * arrive with the content that can be in them — read-only with task 36's affordances to remove,
 * offline and pending with 35.2's autosave.
 */
const MESSAGES = 'organization.wizard';

type Props = { params: Promise<{ locale: string; reportId: string; module: string }> };

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function ReportModuleStepPage({ params }: Props) {
  const { reportId, module } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const t = await getTranslations(MESSAGES);
  const read = await readWizardStep({ reportId, module });

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      <Callout intent={CALLOUT_INTENT.ERROR} title={t('forbidden.title')} action={null}>
        {t('forbidden.body')}
      </Callout>
    );
  }
  if (read.status === TENANT_READ.UNREACHABLE) {
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

  return (
    <WizardShell
      modulesLabel={t('rail.label')}
      modules={
        <ModuleRail
          reportId={reportId}
          modules={read.modules}
          current={module}
          answeredLabel={(m) => t('rail.answered', { answered: m.answered, total: m.total })}
        />
      }
      title={t('step.title', { module })}
      progress={t('step.outstanding', { count: outstanding })}
      exit={
        <TextLink asChild>
          <Link href={ROUTES.REPORTS}>{t('exit')}</Link>
        </TextLink>
      }
    >
      <dl className={styles.fields}>
        {read.step.fields.map((field) => (
          <div key={`${field.elementKey}:${field.dimensionKey}:${field.ordinal}`} className={styles.field}>
            <dt className={styles.label}>{field.label ?? field.elementKey}</dt>
            <dd className={answeredText(field) === null ? styles.unanswered : styles.value}>
              {answeredText(field) ?? t('step.unanswered')}
            </dd>
          </div>
        ))}
      </dl>
    </WizardShell>
  );
}

/**
 * What a field currently says, or `null` where nothing has been answered.
 *
 * **Reads the typed column the value is actually in.** §7.3 stores one of four, and which one is the
 * taxonomy's business rather than this screen's — so this asks the value rather than the element,
 * and a field whose kind and stored column disagree renders as unanswered rather than as a wrong
 * number. Task 36.1 replaces the whole of this with the field anatomy.
 */
function answeredText(field: {
  valueNumeric: string | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  valueDate: string | null;
  unitCode: string | null;
}): string | null {
  if (field.valueNumeric !== null) {
    return field.unitCode === null ? field.valueNumeric : `${field.valueNumeric} ${field.unitCode}`;
  }
  if (field.valueText !== null) return field.valueText;
  if (field.valueDate !== null) return field.valueDate;
  if (field.valueBoolean !== null) return String(field.valueBoolean);
  return null;
}
