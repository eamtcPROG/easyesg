import { describe, expect, it } from 'vitest';
import { LOCALES, findInternalIdentifiers, type Locale } from '@easyesg/i18n';
import en from './en.json';
import ro from './ro.json';
import ru from './ru.json';

/**
 * **No screen string carries a development-side notion** — the root `CLAUDE.md` rule, applied to
 * this app's catalogue.
 *
 * The rule binds *"every surface a person sees — screen labels and help text, validation findings,
 * notification bodies, email, the PDF and Excel exports, and the `title` and `detail` of a
 * problem+json response"*. Task 28.3 gated the last of those seven, in `apps/api`, and built the
 * detector as shared infrastructure in `@easyesg/i18n` to do it. This is the first of them, gated
 * here because it is where the strings live — and because leaving the largest surface unchecked
 * while the smallest one has a gate would be the wrong way round.
 *
 * It is a deliberate step past 28.3's row, taken because the corpus is already clean and the cost
 * is this file. The remaining five surfaces do not exist yet; each should pick this up as it lands.
 *
 * **No problem-type slugs are passed.** Those are the api's vocabulary and cannot reach a screen
 * string authored here; the shape rules are what apply. See the detector for why matching a
 * *shape* rather than a *vocabulary* is the exception and not the default.
 */
const CATALOGUES: Readonly<Record<Locale, unknown>> = { ro, en, ru };

/** Every leaf string, keyed by its dotted path so a failure names the message rather than the file. */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node !== 'object' || node === null) return [];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leaves(value, path ? `${path}.${key}` : key),
  );
}

describe('no screen string carries an internal identifier (NFR-79)', () => {
  it('finds the corpus at all', () => {
    // A content rule over an empty corpus passes — the `boundaries:prove` guard, again.
    expect(leaves(ro).length).toBeGreaterThan(100);
  });

  it.each(LOCALES)('%s is clean', (locale) => {
    const offences = leaves(CATALOGUES[locale])
      .flatMap(([key, text]) =>
        findInternalIdentifiers(text).map((finding) => `${key}: ${finding.rule} — ${finding.match}`),
      )
      .sort();

    expect(offences).toEqual([]);
  });

  /**
   * ICU is the one shape worth pinning here rather than trusting: `{minutes, plural, one {…}}`
   * carries braces, commas and the `#` placeholder, and a detector that read `plural` or a
   * placeholder as a token would flag every pluralised string in the catalogue. `identity.factor`
   * has one in all three locales, so this is a live case rather than a hypothetical.
   */
  it('does not mistake an ICU plural for an identifier', () => {
    expect(
      findInternalIdentifiers('{minutes, plural, one {Mai aveți un minut} other {Mai aveți # minute}}'),
    ).toEqual([]);
  });
});
