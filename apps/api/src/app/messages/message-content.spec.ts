import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '@easyesg/i18n';
import { findInternalIdentifiers } from '@easyesg/i18n';
import { ProblemType } from '../filters/problem-types';

/**
 * **No error body carries a development-side notion** (task 28.3; root `CLAUDE.md`, "User-facing
 * text carries no internal identifiers"; NFR-79).
 *
 * The task row asks that every error body pass the rule *as a test, not as a review note*. This
 * checks the **corpus** rather than driving requests, and that is the stronger claim rather than
 * the cheaper one: every `title` and every `detail` `ProblemDetailsFilter` can emit is a catalogue
 * string resolved by `translate`, on all three of its paths — a `DomainError`'s `messageKey`, a
 * framework exception's `problem.<slug>.detail`, and the internal fallback. So checking the
 * catalogue checks every error body that can exist, including the ones no test happens to trigger.
 * An HTTP-driven version would check the ones somebody remembered to provoke.
 *
 * Two things make that reasoning hold, and both are gated elsewhere rather than assumed here:
 * `message-keys.spec.ts` proves every declared key resolves (a missing one omits `detail` rather
 * than falling back to the slug), and the only `DomainError` carrying params passes two integers,
 * so nothing dynamic reaches a rendered sentence.
 *
 * **The problem-type slugs are handed in from `ProblemType` rather than matched as a shape.** That
 * is the detector's own lesson: a kebab-case pattern flagged `sign-in`, `e-mail` and the Romanian
 * clitics `s-a` and `acceptat-o`, and a rule with that noise is one somebody switches off. A closed
 * vocabulary should be matched, not resembled — and derived from the object, so a slug added later
 * is covered without editing this file.
 *
 * What is deliberately out of scope: the `errors` array on a validation failure. It carries
 * class-validator's field-level output and is addressed to the developer integrating against the
 * API rather than to the person filling in the form — `ProblemDetailsFilter` says so where it
 * passes it through, and `CLAUDE.md` binds `title` and `detail` by name.
 */
const CATALOGUES = join(__dirname, '../../../../../packages/i18n/catalogues');

const SLUGS = Object.values(ProblemType);

/** Every leaf string in a catalogue, keyed by its dotted path so a failure names the message. */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node !== 'object' || node === null) return [];

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leaves(value, path ? `${path}.${key}` : key),
  );
}

const catalogue = (locale: string): [string, string][] =>
  leaves(JSON.parse(readFileSync(join(CATALOGUES, `${locale}.json`), 'utf8')) as unknown);

describe('no user-facing message carries an internal identifier (task 28.3, NFR-79)', () => {
  it('finds the corpus at all', () => {
    // The `boundaries:prove` guard again: a content rule over an empty corpus passes.
    expect(catalogue(LOCALES[0]).length).toBeGreaterThan(50);
  });

  it.each(LOCALES)('%s is clean', (locale) => {
    const offences = catalogue(locale)
      .flatMap(([key, text]) =>
        findInternalIdentifiers(text, SLUGS).map(
          (finding) => `${key}: ${finding.rule} — ${finding.match}`,
        ),
      )
      .sort();

    // Named rather than counted, so the failure is the fix: the key, the rule and the substring.
    expect(offences).toEqual([]);
  });

  /**
   * The gate proving itself. A clean corpus and a broken detector are the same green, and this file
   * would otherwise be the only one in the repository asserting an absence with nothing to show it
   * can detect a presence.
   */
  it('would catch a slug that reached a message', () => {
    const offences = findInternalIdentifiers(
      'Autentificarea a eșuat: credential-invalid.',
      SLUGS,
    );
    expect(offences).toEqual([
      { rule: 'a declared internal term', match: ProblemType.CredentialInvalid },
    ]);
  });

  it('would catch a message key that reached a message', () => {
    // The shape a missing translation used to produce before the filter learned to omit `detail`.
    expect(findInternalIdentifiers('identity.sign_in.credential_invalid', SLUGS)).not.toEqual([]);
  });
});
