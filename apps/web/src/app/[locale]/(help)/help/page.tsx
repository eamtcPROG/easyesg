import { Suspense } from 'react';
import { HelpCentre } from '@/features/public/help/centre/components/section/help-centre';
import { HelpCentreLoading } from '@/features/public/help/centre/components/section/help-centre-loading';
import { generateHelpCentreMetadata } from '@/features/public/help/centre/components/section/help-centre-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-32 — Help centre · VI, CA · UC-180 · Index (§4.6)
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section what the address narrows
 * the library by — a topic and words (UX-4). `HelpCentre` reads and decides the arm; the boundary's fallback is the
 * library's shape.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = generateHelpCentreMetadata;

export default async function HelpCentrePage({ params, searchParams }: Props) {
  const locale = await activateRequestLocale(params);
  const { topic, q } = await searchParams;
  return (
    <Suspense fallback={<HelpCentreLoading />}>
      <HelpCentre
        locale={locale}
        topic={typeof topic === 'string' ? topic : undefined}
        query={typeof q === 'string' ? q : ''}
      />
    </Suspense>
  );
}
