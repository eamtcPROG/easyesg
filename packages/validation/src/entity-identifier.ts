/**
 * FR-16's entity identifiers — the IDNO and the optional LEI (task 29.2).
 *
 * **Here rather than in `apps/api` for the package's stated reason**: the rule runs in two places
 * and must not drift. S-13 shows the verdict inline as the Administrator types (§9.8) and the API
 * re-validates authoritatively in the request that persists the change. FR-107 will want the IDNO
 * rule too, for the billing account's fiscal code — a third caller, in a bounded context that
 * shares no code with `core`, which is exactly what a shared package is for.
 *
 * **Both verdicts separate *shape* from *check digit*, and that is not decoration.** NFR-79 needs
 * the three-part message to say what is wrong, and "this is not thirteen digits" and "the thirteen
 * digits do not agree with each other" have different resolutions — retype it versus check you
 * copied the right one. A single boolean would collapse them into one unhelpful sentence.
 */

/**
 * ISO 17442: twenty characters, upper-case letters and digits, with the last two numeric.
 *
 * **There is deliberately no constraint on positions 5–6.** A first draft here required them to be
 * `00`, from a half-remembered reading of the issuance scheme, and every real LEI in the corpus
 * failed it — Deutsche Bank's carries `FZ`, Barclays' `EF`, JPMorgan's `LX`, BNP Paribas' `WS`.
 * The normative check is the length, the character classes and MOD 97-10; anything else is a
 * property of how prefixes happen to be allocated, and encoding it here would refuse valid
 * identifiers. Caught in one run because the fixtures are published values rather than strings this
 * file produced.
 */
const LEI_LENGTH = 20;
const LEI_SHAPE = /^[A-Z0-9]{18}[0-9]{2}$/u;

/** IDNO: thirteen digits, and the layout Government Decision 272/2002 fixes. */
const IDNO_LENGTH = 13;
const IDNO_SHAPE = /^[0-9]{13}$/u;
/** The repeating weights over the first twelve digits (§12.5.6's task-182 row, 182/12). */
const IDNO_WEIGHTS = [7, 3, 1] as const;

export interface IdentifierVerdict {
  /** The value has the right length and character classes. */
  readonly shape: boolean;
  /**
   * The check digits agree with the rest of the value.
   *
   * **Null means "not evaluated", which is not the same as `false`**, and it happens exactly when
   * `shape` fails: there is nothing well-formed to run a checksum over. A caller telling `null`
   * from `false` is what keeps "retype it" apart from "check you copied the right one".
   */
  readonly checkDigits: boolean | null;
  /** Every evaluated requirement met. The only member a yes/no answer needs. */
  readonly satisfied: boolean;
}

const refused = (): IdentifierVerdict => ({ shape: false, checkDigits: null, satisfied: false });

/**
 * ISO 7064 MOD 97-10 over the whole twenty characters, which is what ISO 17442 specifies.
 *
 * Letters convert to two-digit numbers (`A` = 10 … `Z` = 35) and the concatenation is read as one
 * integer whose remainder modulo 97 must be **1**. That integer is far past `Number.MAX_SAFE_INTEGER`
 * — twenty characters expand to as many as forty digits — so it is folded digit by digit rather
 * than built and divided. `BigInt` would also work and is slower for no gain in clarity here.
 */
const mod97 = (value: string): number => {
  let remainder = 0;
  for (const character of value) {
    const code = character.charCodeAt(0);
    // '0'–'9' are 48–57; 'A'–'Z' are 65–90 and map to 10–35.
    const digits = code <= 57 ? String(code - 48) : String(code - 55);
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder;
};

/**
 * The Legal Entity Identifier (ISO 17442), optional per OQ-18 and kept so B1 stays conformant for
 * the banks and EU buyers who require one.
 *
 * **Case is not normalised here.** ISO 17442 defines the LEI over upper-case characters, and the
 * check digits are computed over those; lower case is a different string and rejecting it is
 * correct. Trimming and upper-casing belong at the edge that reads user input, where the same
 * `@Trim()` already runs — a validator that quietly repaired its input would return `satisfied`
 * for a value the caller then stored unrepaired.
 */
export function validateLei(value: string): IdentifierVerdict {
  if (value.length !== LEI_LENGTH || !LEI_SHAPE.test(value)) return refused();

  const checkDigits = mod97(value) === 1;
  return { shape: true, checkDigits, satisfied: checkDigits };
}

export function leiIsValid(value: string): boolean {
  return validateLei(value).satisfied;
}

/**
 * The thirteenth digit an IDNO's first twelve call for: each multiplied by 7, 3, 1 repeating, the
 * sum taken modulo 10. Only ever called on a value that passed the shape, so every character is a
 * digit.
 */
const idnoCheckDigit = (value: string): number => {
  let sum = 0;
  for (let position = 0; position < IDNO_LENGTH - 1; position += 1) {
    sum += Number(value[position]) * IDNO_WEIGHTS[position % IDNO_WEIGHTS.length];
  }
  return sum % 10;
};

/**
 * The IDNO — Moldova's state identification number, and FR-16's **primary** identifier per OQ-18.
 *
 * Thirteen digits, laid out by Government Decision 272/2002 as one index digit, the last three of
 * the year of assignment, a three-digit registering-authority code, a five-digit sequence, and a
 * check digit.
 *
 * **The check digit's algorithm is not in that decision, and §7.2 records where it came from**: the
 * decree names the digit and gives no formula, and the weights above were supplied with their
 * provenance on 5 Oct 2026 (182/12) — checked there against the State Register's own export, and
 * outside the weighted-modulo-11 family §7.2 refuted earlier. That provenance is the reason this
 * check is allowed to refuse: a guessed algorithm would reject real IDNOs, which is worse than not
 * checking, and was why `checkDigits` stayed `null` until task 188.
 *
 * Every caller gains the check from this one function — the API, S-13 inline, and FR-107's billing
 * fiscal code — which is why it lives in a shared package rather than at a call site.
 */
export function validateIdno(value: string): IdentifierVerdict {
  if (value.length !== IDNO_LENGTH || !IDNO_SHAPE.test(value)) return refused();

  const checkDigits = idnoCheckDigit(value) === Number(value[IDNO_LENGTH - 1]);
  return { shape: true, checkDigits, satisfied: checkDigits };
}

export function idnoIsValid(value: string): boolean {
  return validateIdno(value).satisfied;
}
