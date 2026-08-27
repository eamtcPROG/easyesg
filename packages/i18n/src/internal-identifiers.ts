/**
 * **Detects development-side notions in text a person reads** — the root `CLAUDE.md` rule
 * ("User-facing text carries no internal identifiers"), as a function rather than a review note.
 *
 * It lives here because this package owns locale content and both front ends and the api already
 * depend on it; each workspace points it at its own corpus and adds the vocabularies only it knows
 * (`apps/api` supplies its problem-type slugs, for instance).
 *
 * ## Why the patterns are shaped the way they are
 *
 * The first draft matched **kebab-case** as a proxy for a problem-type slug, and over the real
 * corpus it flagged `sign-in`, `e-mail`, and the Romanian clitics `s-a`, `v-o`, `a-l` and
 * `acceptat-o` — nineteen hits in `ro.json` alone, none of them a defect. A detector with that
 * signal-to-noise is one somebody switches off, which is worse than not having it.
 *
 * So the rule is: **match the actual vocabulary where one exists, and a shape only where none
 * does.** Problem-type slugs are a closed set the api can hand in, so they are matched exactly.
 * The shapes that survive are the ones with no legitimate reading in prose — a spec identifier, a
 * `SCREAMING_SNAKE` enum member, a `schema.table` reference, a `snake_case` token. Each was
 * measured against all three catalogues before being kept, and each scored zero false positives.
 *
 * What it deliberately does not look for: a bare table name (`credential`, `session`) or a
 * single-word enum value (`active`, `unverified`), because those are ordinary words and matching
 * them would reintroduce exactly the noise the kebab-case draft produced. The dangerous form of
 * both — qualified or multi-word — is covered above.
 */

export interface IdentifierFinding {
  /** Which rule fired, in words a failure message can print. */
  readonly rule: string;
  /** The offending substring, so the failure names the thing rather than the string. */
  readonly match: string;
}

/**
 * The shapes. Each is a *form* that has no innocent reading in a sentence a user reads.
 *
 * They use `\b`, which is right here because each shape's own body spans the separators — a
 * `snake_case` token contains its underscores, so `\b` cannot split it mid-identifier. The declared
 * terms below need the stricter boundary instead, because `\b` treats `-` as a break and would
 * match `sign-in` inside `re-sign-into`.
 */
const SHAPES: readonly { readonly rule: string; readonly pattern: RegExp }[] = [
  {
    // FR-123, UC-45, NFR-79, AD-7, DR-1, UX-89, OQ-43, BR-ID-4.
    rule: 'a specification identifier',
    pattern: /\b(?:FR|UC|NFR|AD|DR|UX|OQ|BR)-[A-Z]*-?\d+\b/u,
  },
  {
    // VALUE_INCONSISTENCY, ACCOUNT_STATUS — an `as const` member, read aloud.
    rule: 'an enum member',
    pattern: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/u,
  },
  {
    // identity.credential, core.organization — a schema-qualified database object.
    rule: 'a database object',
    pattern: /\b(?:core|identity|billing|audit|config)\.[a-z][a-z0-9_]*\b/u,
  },
  {
    // allow_with_warning, organization_id, password_reset — a column, a key or an enum value.
    rule: 'a snake_case token',
    pattern: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u,
  },
  {
    // `at Object.<anonymous> (/app/dist/...)` — a stack frame that reached a reader.
    rule: 'a stack frame',
    pattern: /\bat\s+[\w$.<>]+\s+\(/u,
  },
];

/**
 * Every internal identifier in `text`, or an empty array.
 *
 * @param forbiddenTerms exact strings the caller knows to be internal — problem-type slugs, job
 *   names, taxonomy element keys. Matched whole and case-insensitively, so `Sign-in` in a sentence
 *   is safe while the slug `credential-invalid` is not. Pass the vocabulary's own
 *   `Object.values(...)` rather than a hand-written list, so a member added later is covered.
 *
 *   **A term that is a single all-lowercase word is skipped**, and that is the rule rather than an
 *   escape from it. `ProblemType` contains `conflict` and `internal`; both are ordinary words, and
 *   matching them flagged the English `problem.conflict.title` — which reads "Conflict" — as a
 *   defect. An internal identifier is recognisable by being *un-word-like*: hyphenated, snake_cased
 *   or mixed-case. A lowercase single word carries no evidence of being an identifier at all, so a
 *   match on one is a coincidence of spelling. `EnergyConsumptionFromRenewableSources` is still
 *   caught, because it is not lowercase.
 *
 *   The cost is stated rather than hidden: a message that said only "conflict" would pass. That
 *   sentence would fail NFR-79's three-part shape long before this rule, and buying it would cost
 *   every legitimate use of two common words.
 */
export function findInternalIdentifiers(
  text: string,
  forbiddenTerms: readonly string[] = [],
): IdentifierFinding[] {
  const findings: IdentifierFinding[] = [];

  for (const { rule, pattern } of SHAPES) {
    const found = pattern.exec(text);
    if (found) findings.push({ rule, match: found[0] });
  }

  for (const term of forbiddenTerms) {
    // See the note on `forbiddenTerms`: a lowercase single word is prose, not evidence.
    if (/^[a-z]+$/u.test(term)) continue;
    // Escaped, because a term may carry regex metacharacters — a taxonomy key legitimately can.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'iu').test(text)) {
      findings.push({ rule: 'a declared internal term', match: term });
    }
  }

  return findings;
}
