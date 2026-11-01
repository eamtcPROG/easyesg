'use client';

import { useSearchParams } from 'next/navigation';
import { LocaleChoiceMenu } from './locale-choice-menu';

/**
 * The language switcher with the current query string — `LocaleChoiceMenu` reading the one thing it cannot be handed by
 * a Server Component, so a verification token survives the switch (UX-4).
 *
 * **Its own file since task 74.4**, so the read can sit under a boundary: on a prerendered page `useSearchParams` must be
 * inside `<Suspense>`, whose fallback is the menu with no query — the address a static page was built for.
 */
export function LocaleChoice() {
  return <LocaleChoiceMenu query={useSearchParams().toString()} />;
}
