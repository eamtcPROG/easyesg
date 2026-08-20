/**
 * The password policy (architecture.md §9.1, §12.5.6 — OQ-51, closed 20 Aug 2026).
 *
 * Nothing in the seven documents stated one before task 19: §9.1 closed the *hashing* and
 * `design_spec.md` S-02 required "password policy enforced on entry" against a policy nobody had
 * written. These are the values that closed it, and they live here — one function, called by the
 * use case — rather than in a `class-validator` decorator on the request DTO. That placement is
 * the decision: a policy expressed as `@MinLength(8) @Matches(/…/)` is a second copy of a rule the
 * moment anything else needs to evaluate it, and it produces `class-validator`'s developer-facing
 * `errors` array where NFR-79 requires a three-part sentence the account holder can act on.
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
 * Length is counted in code points, not UTF-16 units, so an emoji is one character rather than
 * two. `[...password]` iterates code points; `password.length` would not.
 */
export function passwordMeetsPolicy(password: string): boolean {
  const characters = [...password];

  if (characters.length < PASSWORD_MIN_LENGTH) return false;
  if (characters.length > PASSWORD_MAX_LENGTH) return false;

  return (
    LOWERCASE.test(password) &&
    UPPERCASE.test(password) &&
    DIGIT.test(password) &&
    characters.some(isFurtherCharacter)
  );
}
