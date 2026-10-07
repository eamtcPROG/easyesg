import { CalculatorStep } from '@/features/calculator/components/section/calculator-step';
import { CALCULATOR_MESSAGES } from '@/features/calculator/components/shared/calculator-messages';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { CALCULATOR_LINE_PARAM, CALCULATOR_SITE_PARAM } from '@/lib/routes';

/**
 * S-09 — Carbon calculator · RC · UC-32 … 34 · Wizard sub-flow (composes Wizard; §4.6, OQ-7)
 *
 * UX-40: consumption is entered in the units of the reader's own invoices — B3 asks for tonnes of CO₂e and nobody has
 * a bill in tonnes. UX-41: the lines stay on screen and editable after a calculation, as the permanent record.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the report, the site the
 * address shows (`?site=`, §4.7's site chips) and the line whose derivation it opens (`?line=`, task 39.2). `CalculatorStep` reads, decides the arm and draws the wizard shell
 * around the calculator — S-07's, with B3 marked in the rail. **No `loading.tsx`**, for S-07's reason: a report whose
 * taxonomy carries no B3 is answered with `notFound()` from the section, which a route-level boundary would flush past.
 */
type Props = {
  params: Promise<{ locale: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(CALCULATOR_MESSAGES);

export default async function CarbonCalculatorPage({ params, searchParams }: Props) {
  const { reportId } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  const query = await searchParams;
  return (
    <CalculatorStep reportId={reportId} site={query[CALCULATOR_SITE_PARAM]} line={query[CALCULATOR_LINE_PARAM]} />
  );
}
