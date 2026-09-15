'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { LocaleChoice } from '@/shared/locale-choice';

/**
 * **In `identity/shared/components/` on a different test from its siblings: one reader, the `(identity)` layout — which is why it is chrome shared by every journey rather than any journey's part, and why it is here and not in `src/shared/`, whose chrome is the authenticated tier's.**
 *
 * The Focus header's actions (IMPLEMENTATION_PLAN Phase 2: the language switcher lands here
 * because identity is the first surface that has one). The legal footer used to live here too
 * and now lives in `src/shared/site-footer.tsx` — it is shared with the public surfaces, and it
 * belongs on the server, which this file is not.
 *
 * **The switcher itself moved to `src/shared/locale-choice.tsx` (task 74.1)** for the reason the
 * footer moved: the public chrome carries the same control, and a second copy of the wiring is
 * what UX-89 forbids. What is left here is this header's own composition — the help link beside a
 * switcher that, since task 158, resolves its own words and takes nothing from this file.
 */
export function IdentityHeaderActions() {
  const t = useTranslations('chrome');

  return (
    <>
      <Link href={ROUTES.HELP_CENTRE}>{t('helpCentre')}</Link>
      <LocaleChoice />
    </>
  );
}

/**
 * The footer moved to `src/shared/site-footer.tsx` (21 Aug 2026): the public and help surfaces
 * carry the same one, and as a Server Component it computes the copyright year from the clock
 * once, rather than shipping a client component that would compute it on both sides.
 */
