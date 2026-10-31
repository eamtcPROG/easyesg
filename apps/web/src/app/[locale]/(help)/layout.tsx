import type { ReactNode } from 'react';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';
import { readSession } from '@/server/session/session';
import { AppFrame } from '@/shared/app-frame';
import { PublicFrame } from '@/shared/public-frame';

/**
 * The help centre's chrome — S-32 … S-34 (task 77; UC-180 … UC-182; `architecture.md` §12.5.6's task-77 row (10)).
 *
 * **One screen with a session-dependent shell, not two** (S-32): a signed-in reader is in the product's chrome — the
 * global tier, with everything a signed-in screen sits beneath — and a visitor in the public band. **The layout reads the
 * session only to choose the chrome**; the screens beneath read none (`design_spec.md` §5.1b as amended), so
 * `web-public-is-a-leaf` still holds for `features/public/help`.
 *
 * **Its own group rather than `(public)`'s**, because that layout is the public band for everyone and this is not; the
 * addresses are still the unauthenticated segment `help` (`lib/route-access.ts`), so a visitor is never sent to sign in.
 * **Rendered per request**, since what it draws depends on the reader — outside §14.2's static zone, and never cached.
 */
export const dynamic = 'force-dynamic';

export default async function HelpLayout({ children, params }: { children: ReactNode; params: LocaleParams }) {
  await activateRequestLocale(params);
  const session = await readSession();
  return session === null ? <PublicFrame>{children}</PublicFrame> : <AppFrame>{children}</AppFrame>;
}
