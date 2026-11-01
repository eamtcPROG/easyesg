import { describe, expect, it } from 'vitest';
import { withCanonical } from './canonical-link';

/**
 * The canonical rides beside next-intl's alternates (task 74.5). The header below is the shape
 * `getAlternateLinksHeaderValue` writes under `localePrefix: 'as-needed'` — Romanian unprefixed and `x-default` —
 * copied from a real response, so the parse is tested against what the proxy is actually handed.
 */
const LINK =
  '<https://easyesg.md/en/legal/terms>; rel="alternate"; hreflang="en", ' +
  '<https://easyesg.md/legal/terms>; rel="alternate"; hreflang="ro", ' +
  '<https://easyesg.md/ru/legal/terms>; rel="alternate"; hreflang="ru", ' +
  '<https://easyesg.md/legal/terms>; rel="alternate"; hreflang="x-default"';

describe('withCanonical', () => {
  it('appends the alternate for the page’s own locale as its canonical, keeping every alternate', () => {
    expect(withCanonical({ link: LINK, locale: 'en' })).toBe(
      `${LINK}, <https://easyesg.md/en/legal/terms>; rel="canonical"`,
    );
  });

  it('points the source locale at its unprefixed address, not at x-default by accident of order', () => {
    expect(withCanonical({ link: LINK, locale: 'ro' })).toBe(
      `${LINK}, <https://easyesg.md/legal/terms>; rel="canonical"`,
    );
    expect(withCanonical({ link: LINK, locale: 'ru' })).toMatch(
      /<https:\/\/easyesg\.md\/ru\/legal\/terms>; rel="canonical"$/,
    );
  });

  it('writes nothing when there is no header to ground it in', () => {
    expect(withCanonical({ link: null, locale: 'ro' })).toBeNull();
    expect(withCanonical({ link: '', locale: 'ro' })).toBeNull();
  });

  it('writes nothing when the header names no alternate for the locale', () => {
    expect(
      withCanonical({
        link: '<https://easyesg.md/en>; rel="alternate"; hreflang="en"',
        locale: 'ru',
      }),
    ).toBeNull();
  });
});
