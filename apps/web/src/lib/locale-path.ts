import { isLocale, type Locale } from '@easyesg/i18n';

/**
 * The sign-in return path, made safe and split for `@/i18n/navigation`'s `redirect`.
 *
 * `?return=` is written by `proxy.ts` (UX-38: expiry returns the user to the exact screen) but
 * arrives back through the browser, so it is attacker-shapeable: a crafted link could put an
 * absolute URL there and turn sign-in into an open redirect. Only a same-app path survives —
 * one leading `/`, and not `//` or `/\`, both of which browsers read as scheme-relative.
 *
 * The split matters because the stored pathname carries its locale prefix (`/en/reports`)
 * while next-intl's `redirect` takes an UNPREFIXED href plus a `locale` — handing it the
 * prefixed form would render `/en/en/reports`. A returned `locale` of `undefined` means the
 * path named none, i.e. the source locale's unprefixed form (`localePrefix: 'as-needed'`) —
 * the caller decides what that defaults to (sign-in uses the account's profile preference
 * only when there was no return path at all; a Romanian URL stays Romanian).
 */

export interface LocalizedPath {
  href: string;
  locale: Locale | undefined;
}

export function splitLocalePrefix(path: string): LocalizedPath {
  // The query is split off first so a bare prefixed path keeps working: `/en?x=1` must read as
  // locale `en`, href `/?x=1` — not as a first segment of `en?x=1` that matches no locale.
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : path.slice(queryIndex);
  const [first, ...rest] = pathname.split('/').filter(Boolean);
  if (!isLocale(first)) return { href: path, locale: undefined };
  return { href: `/${rest.join('/')}${query}`, locale: first };
}

/** `null` for anything that is not a same-app path — the caller falls back to its default. */
export function sanitizeReturnPath(candidate: string | undefined): LocalizedPath | null {
  if (!candidate?.startsWith('/')) return null;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return null;
  return splitLocalePrefix(candidate);
}
