import { notFound } from 'next/navigation';
import { localizedPageTitle } from '@/i18n/page';

/**
 * Every address under `[locale]` that matches no other route (task 103).
 *
 * **Its entire job is to convert "no route matched" into an explicit `notFound()`**, because that
 * is the only thing a nested not-found boundary reacts to — next-intl documents this pair, and
 * without it `[locale]/not-found.tsx` never renders for an unknown path and Next's unstyled default
 * is served instead. The page therefore has no markup of its own; `not-found.tsx` is the surface.
 *
 * **It cannot shadow a real screen.** Next resolves static segments before dynamic ones and
 * catch-alls last, so `/reports` reaches `(workspace)/reports` and only an address nothing else
 * claims arrives here. Route groups add no segment, so every screen in `(app)`, `(identity)` and
 * `(public)` is a sibling that wins.
 *
 * `generateMetadata` is here rather than on the boundary because Next collects metadata from pages
 * only — this is the one half of the pair it treats as one, so WCAG 2.4.2's page title comes from
 * this file even though nothing it renders reaches the reader.
 */
export const generateMetadata = localizedPageTitle('chrome.notFound');

export default function CatchAllPage() {
  notFound();
}
