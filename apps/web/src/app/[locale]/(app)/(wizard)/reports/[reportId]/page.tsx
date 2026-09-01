import { redirect } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { firstIncompleteModule, readWizardModules } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';
import { reportStepRoute } from '@/lib/routes';

/**
 * S-07 entry — resolves to the first incomplete module and redirects (UX-10).
 *
 * *"Opening a report shall place the user at the first incomplete step, not at the beginning."*
 * This segment renders nothing; it exists to perform that resolution, so the step a reporter lands
 * on has a URL of its own from the first moment rather than after a client-side decision (UX-4).
 *
 * **A failed read is a 404 rather than a redirect to a guess.** Sending someone to `B1` on a report
 * that refused to answer would put them in a wizard whose rail is empty and whose fields will not
 * load — a screen that looks like the product working.
 */
type Props = { params: Promise<{ locale: string; reportId: string }> };

export default async function ReportEntryPage({ params }: Props) {
  const { reportId } = await params;
  // The narrowed locale `activateRequestLocale` returns, never the raw param: `localePrefix:
  // 'as-needed'` serves Romanian unprefixed, so a hand-built path would be wrong for one of three.
  const locale = await activateRequestLocale(params as unknown as LocaleParams);
  const read = await readWizardModules(reportId);
  if (read.status !== TENANT_READ.READY) notFound();

  // Not named `module`: Next reserves that identifier, and the rule exists because assigning it
  // breaks the bundler's own module scope rather than merely reading oddly.
  const firstStep = firstIncompleteModule(read.modules);
  if (firstStep === undefined) notFound();

  redirect({ href: reportStepRoute({ reportId, module: firstStep }), locale });
}
