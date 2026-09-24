import { PeriodRecordSection } from '@/features/periods/components/period-record-section';
import { PERIODS_MESSAGES } from '@/features/periods/components/periods-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-14's Record for one period (UC-56 … UC-58).
 *
 * **A shell since task 137** (`shell-composes-only`): it pins the locale and renders the section, which reads, decides
 * the arm and draws (`features/periods/components/period-record-section.tsx`). `loading.tsx` beside it is the record's
 * own **loading — initial**, where the periods index's used to stand in for it.
 *
 * States (§8.1): ready · read-only (locked, FR-22) · error — permission · error — recoverable.
 */
type Props = { params: Promise<{ locale: string; entityId: string; periodId: string }> };

export const generateMetadata = localizedPageTitle(PERIODS_MESSAGES);

export default async function ReportingPeriodRecordPage({ params }: Props) {
  const { entityId, periodId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <PeriodRecordSection entityId={entityId} periodId={periodId} />;
}
