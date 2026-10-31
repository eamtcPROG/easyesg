import { Suspense } from 'react';
import { HelpCentre } from '@/features/public/help/centre/components/section/help-centre';
import { HelpCentreLoading } from '@/features/public/help/centre/components/section/help-centre-loading';
import { generateHelpCentreMetadata } from '@/features/public/help/centre/components/section/help-centre-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';
import { readKnownReader } from '@/server/session/known-reader';

/**
 * S-32 — Help centre · VI, CA · UC-180 · Index (§4.6), as artboards 01 and 02 draw it (task 227)
 *
 * **This file is a shell** (`shell-composes-only`), **with the one read the amendment puts here** (`architecture.md`
 * §12.5.6's task-77 row (10)): the signed-in reader the opening greets by name, read beside the session and handed
 * down, since nothing under `features/public` reads one — a visitor is handed `null`. It pins the locale and hands the
 * section what the address holds — a topic, words and the help's language (UX-4). `HelpCentre` reads and decides the
 * arm; the boundary's fallback is the screen's shape.
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = generateHelpCentreMetadata;

export default async function HelpCentrePage({ params, searchParams }: Props) {
  const page = await activateRequestLocale(params);
  const [{ topic, q, content }, reader] = await Promise.all([searchParams, readKnownReader()]);
  return (
    <Suspense fallback={<HelpCentreLoading />}>
      <HelpCentre
        page={page}
        requestedContent={typeof content === 'string' ? content : undefined}
        topic={typeof topic === 'string' ? topic : undefined}
        query={typeof q === 'string' ? q : ''}
        reader={reader === null ? null : { name: reader.name }}
      />
    </Suspense>
  );
}
