/**
 * The password policy (architecture.md §9.1, §9.8, §12.5.6 — OQ-51, closed 20 Aug 2026).
 *
 * Moved here from `apps/api`'s identity domain in task 20 (architecture.md §9.8 records the
 * decision): S-02 requires the policy enforced at the point of entry, `apps/web` may not import
 * `apps/api/src`, and a re-statement of the rule client-side is the second source of truth §9.8
 * exists to prevent. One implementation, two execution sites — the API remains authoritative and
 * re-exports this module from its identity domain, so its behaviour did not move.
 *
 * The values themselves are OQ-51's: nothing in the seven documents stated a policy before
 * task 19; §9.1 closed the *hashing* and `design_spec.md` S-02 required "password policy enforced
 * on entry" against a policy nobody had written. They live here as one function rather than in a
 * `class-validator` decorator on the request DTO, because a policy expressed as
 * `@MinLength(8) @Matches(/…/)` is a second copy of the rule the moment anything else needs to
 * evaluate it — which is exactly what happened in task 20.
 *
 * **Character classes are matched by Unicode property, never by `[a-z]`.** The live locales are
 * Romanian and Russian (NFR-23), so `ă`, `ș`, `Ț` and `д` are ordinary letters to the people
 * typing them; an ASCII class test would tell a Russian speaker their password has no lowercase
 * letter in it. `\p{Ll}` and `\p{Lu}` are cased-letter properties and cover Latin, Cyrillic and
 * Greek alike.
 *
 * **The ceiling is a cost bound, not a rule about secrets.** Argon2id is deliberately expensive,
 * so an unbounded input is an unbounded amount of work an unauthenticated caller can ask for.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const LOWERCASE = /\p{Ll}/u;
const UPPERCASE = /\p{Lu}/u;
const DIGIT = /\p{Nd}/u;

/**
 * "One further character" is defined as one that is none of the three above, rather than as a
 * list of permitted symbols. A denylist of punctuation would quietly exclude whatever a password
 * manager happens to generate, which is the population this policy least wants to turn away.
 */
const isFurtherCharacter = (character: string): boolean =>
  !LOWERCASE.test(character) && !UPPERCASE.test(character) && !DIGIT.test(character);

/**
 * One member per requirement the policy states, so S-02 can show the policy as a checklist that
 * answers itself while the user types — the requirement is *displayed before entry rather than
 * only on failure* — without the screen re-deriving any rule.
 */
export interface PasswordPolicyVerdict {
  /** ≥ 8 and ≤ 128 characters, counted in code points. */
  readonly length: boolean;
  readonly lowercase: boolean;
  readonly uppercase: boolean;
  readonly digit: boolean;
  /** At least one character that is none of the three classes above. */
  readonly further: boolean;
  /** Every requirement at once — the only member the API's yes/no answer needs. */
  readonly satisfied: boolean;
}

/**
 * Length is counted in code points, not UTF-16 units, so an emoji is one character rather than
 * two. `[...password]` iterates code points; `password.length` would not.
 */
export function evaluatePasswordPolicy(password: string): PasswordPolicyVerdict {
  const characters = [...password];

  const length =
    characters.length >= PASSWORD_MIN_LENGTH && characters.length <= PASSWORD_MAX_LENGTH;
  const lowercase = LOWERCASE.test(password);
  const uppercase = UPPERCASE.test(password);
  const digit = DIGIT.test(password);
  const further = characters.some(isFurtherCharacter);

  return {
    length,
    lowercase,
    uppercase,
    digit,
    further,
    satisfied: length && lowercase && uppercase && digit && further,
  };
}

export function passwordMeetsPolicy(password: string): boolean {
  return evaluatePasswordPolicy(password).satisfied;
}
