import type { Locale } from '@easyesg/i18n';
import { LOCALES } from '@easyesg/i18n';
import type { SwitcherLocale } from '@easyesg/ui';
import { useLocale, useTranslations } from 'next-intl';

/**
 * The locale this page is read in, and every registered locale named in its own language — what each
 * of the chrome's language choices draws (task 158).
 *
 * **In `shared/` because more than one sibling reads it**: `account-corner.tsx`, `workspace-drawer.tsx`,
 * `public-drawer.tsx` and `locale-choice.tsx`. Each took the pair as props, resolved by the component
 * above it, and each of those callers wrote its own `LOCALES.map` — an operation over a vocabulary
 * retyped per caller, which is the shape the root `CLAUDE.md`'s vocabulary rule says belongs in one
 * place.
 *
 * **An array rather than a lookup**, so no caller reads the registry or needs a fallback for a code the
 * catalogue is missing: a bare `ro` rendered where *Română* belongs is the silent wrong answer a
 * `?? code` would produce. The key is typed over `Locale`, so a registered locale the catalogue does not
 * name fails `pnpm typecheck` here rather than rendering a blank in a menu.
 */
export function useLocaleNames(): {
  readonly locale: Locale;
  readonly locales: readonly SwitcherLocale<Locale>[];
} {
  const t = useTranslations('chrome.locales');
  return { locale: useLocale(), locales: LOCALES.map((code) => ({ code, label: t(code) })) };
}
