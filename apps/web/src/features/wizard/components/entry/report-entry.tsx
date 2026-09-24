import type { Locale } from 'next-intl';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { reportStepRoute } from '@/lib/routes';
import { readWizardModules, resumeModule } from '@/server/data/wizard';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';

/**
 * S-07's entry (UC-36, UX-10; task 35.3's rule in `resumeModule`) — reads the report's modules and **redirects to
 * where work last happened, else the first incomplete module**, so the step a reporter lands on has a URL of its own
 * from the first moment (UX-4). It renders nothing, which is its whole job; the route is a shell over it (task 137).
 *
 * **A failed read is a 404 rather than a redirect to a guess**: sending someone to `B1` on a report that refused to
 * answer would put them in a wizard whose rail is empty and whose fields will not load — a screen that looks like the
 * product working. **No `loading.tsx` over it**: a boundary at `[reportId]` would also wrap every step beneath it,
 * and fall back over the wizard on each module switch.
 *
 * `locale` is the narrowed one the shell's `activateRequestLocale` returned, never the raw param: `localePrefix:
 * 'as-needed'` serves Romanian unprefixed, so a hand-built path would be wrong for one of three.
 */
export async function ReportEntry({ reportId, locale }: { readonly reportId: string; readonly locale: Locale }) {
  const read = await readWizardModules(reportId);
  // A choice not made is S-37's to answer, not a 404's (`organization-choice-gate.tsx` says why here).
  if (read.status === TENANT_READ.FORBIDDEN) await redirectToChoiceIfOwed();
  if (read.status !== TENANT_READ.READY) notFound();

  // Not named `module`: Next reserves that identifier, and the rule exists because assigning it
  // breaks the bundler's own module scope rather than merely reading oddly.
  const step = resumeModule(read.modules);
  if (step === undefined) notFound();

  redirect({ href: reportStepRoute({ reportId, module: step }), locale });
  // Unreachable — `redirect` throws — and here because next-intl types it as returning, which would leave this a
  // component that returns nothing JSX accepts.
  return null;
}
