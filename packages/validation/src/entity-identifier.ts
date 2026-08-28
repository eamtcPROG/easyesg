/**
 * FR-16's entity identifiers — the IDNO and the optional LEI (task 29.2).
 *
 * **Here rather than in `apps/api` for the package's stated reason**: the rule runs in two places
 * and must not drift. S-15 shows the verdict inline as the Administrator types (§9.8) and the API
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

export interface IdentifierVerdict {
  /** The value has the right length and character classes. */
  readonly shape: boolean;
  /**
   * The check digits agree with the rest of the value.
   *
   * **Null means "not evaluated", which is not the same as `false`.** It is what a caller must
   * distinguish to avoid telling someone their correct identifier is wrong: `shape` failing means
   * there is nothing to run a checksum over, and for the IDNO it also covers the interval before
   * the algorithm is in hand (see `validateIdno`).
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
 * The IDNO — Moldova's state identification number, and FR-16's **primary** identifier per OQ-18.
 *
 * Thirteen digits, laid out by Government Decision 272/2002 as one index digit, the last three of
 * the year of assignment, a three-digit registering-authority code, a five-digit sequence, and a
 * check digit.
 *
 * **The check digit is not evaluated yet, and `checkDigits: null` is how this function says so.**
 * The algorithm lives in Annex 2 of that decision, which is not published anywhere reachable —
 * `legis.md` refuses automated retrieval and no secondary source carries the weights. Guessing a
 * plausible modulus would be worse than not checking: a wrong algorithm **rejects real IDNOs**,
 * turning a validator meant to catch a filing-time error into one that stops correct registrations
 * at the door. So the shape is checked, the verdict says plainly that the checksum was not run,
 * and `satisfied` reports only what was actually established.
 *
 * Nothing else needs to change when the annex arrives: fill in the checksum here and every caller —
 * the API, S-15, and FR-107's billing fiscal code — gains it at once, which is why this lives in a
 * shared package rather than at a call site.
 */
export function validateIdno(value: string): IdentifierVerdict {
  if (value.length !== IDNO_LENGTH || !IDNO_SHAPE.test(value)) return refused();
  return { shape: true, checkDigits: null, satisfied: true };
}

export function idnoIsValid(value: string): boolean {
  return validateIdno(value).satisfied;
}
