import type { Report } from '@easyesg/contracts';
import type { useFormatter, useTranslations } from 'next-intl';
import { calendarDay } from '@/lib/legal-date';

type WizardTranslator = ReturnType<typeof useTranslations<'organization.wizard'>>;
type ReportsTranslator = ReturnType<typeof useTranslations<'organization.reports'>>;
type Formatter = ReturnType<typeof useFormatter>;

/**
 * What a report is called in a bar above it — *VSME 2026 — Basic Module*, and beneath it the undertaking, the period
 * and where the report stands (task 179.1). **Shared since task 43.2**, when S-10's bar came to name the report S-07's
 * bar names, so the two cannot call one report two things.
 */
export function reportIdentity(input: {
  readonly report: Report;
  readonly t: WizardTranslator;
  readonly tReports: ReportsTranslator;
  readonly format: Formatter;
}): { readonly title: string; readonly meta: string } {
  const { subject } = input.report;
  const period = input.format.dateTimeRange(
    calendarDay(subject.periodStart),
    calendarDay(subject.periodEnd),
    'calendar',
  );
  return {
    title: input.t('bar.title', { year: String(subject.fiscalYear), scope: input.report.scope }),
    meta: input.t('bar.meta', {
      entity: subject.entityName,
      period,
      standing: input.tReports(`status.${input.report.status}`),
    }),
  };
}
