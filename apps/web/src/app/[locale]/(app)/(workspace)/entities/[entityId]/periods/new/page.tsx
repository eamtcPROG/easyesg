import { NewPeriodSection } from '@/features/periods/components/new-period-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-14's Record in its create mode (UC-56).
 *
 * **A literal segment rather than a query flag**, following `ENTITY_NEW`: an unsaved new period is
 * an address the reader can return to (UX-4).
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and renders the section, which
 * reads the entity its trail names and decides the arm — the page read nothing until S-14 took S-13's
 * way back (30 Sep 2026). `loading.tsx` beside it is the screen's `loading — initial`.
 */
const MESSAGES = 'organization.periods';

type Props = {
  params: Promise<{ locale: string; entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function NewReportingPeriodPage({ params, searchParams }: Props) {
  const { entityId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);

  return <NewPeriodSection entityId={entityId} searchParams={searchParams} />;
}
