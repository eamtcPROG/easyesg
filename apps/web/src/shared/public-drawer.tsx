'use client';

import { useSearchParams } from 'next/navigation';
import { PublicDrawerMenu } from './public-drawer-menu';

/**
 * The `(public)` chrome's drawer with the current query string — `PublicDrawerMenu` reading what a Server Component
 * cannot hand it. Split from the menu by task 74.4 for `LocaleChoice`'s reason: on a prerendered page this read sits
 * under `<Suspense>`, and the menu with no query is the fallback.
 */
export function PublicDrawer() {
  return <PublicDrawerMenu query={useSearchParams().toString()} />;
}
