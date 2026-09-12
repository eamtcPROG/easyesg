/**
 * `design_spec.md` UX-137, as a function.
 *
 * A person supplies a **given name** and a **family name** (FR-9). The display name is **derived
 * from them and never stored** — a stored composite is a third value free to disagree with the two
 * it was built from, and a rename that updates the parts and not the composite (or the reverse)
 * leaves nothing able to say which is right. Deriving makes that disagreement unrepresentable and
 * costs one pure function.
 *
 * **One order, in all three locales.** Romanian, English and Russian all place the given name first
 * in address, so there is no per-locale table here to keep in step. UX-137 records the condition
 * under which that stops being enough — a locale whose convention reverses it, Hungarian or
 * Japanese — and what changes then is **this function**, not the schema, because the two parts are
 * already stored separately. That is the whole reason the columns are two.
 *
 * **Pure, and in `domain/`.** No database, no request, no locale negotiation: the inputs are two
 * optional strings and the fallback address. `one-idea-per-file`'s *pure logic leaves the
 * component* applied to a use case — every branch below is a unit spec, including the ones a
 * browser journey could only reach by contriving an account.
 */

/** What the account holds. Both parts are optional in the schema and the reasons are in the migration. */
export interface AccountName {
  readonly givenName: string | null;
  readonly familyName: string | null;
}

/** Trims and treats whitespace-only as absent: a name-shaped hole is not a name. */
const present = (part: string | null | undefined): string | null => {
  const trimmed = part?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The name a surface shows. Falls back through UX-137's order: both parts, then whichever one is
 * present, then the address — which is what every screen rendered before task 139 and remains
 * correct for an account whose provider asserted no name.
 */
export const displayName = (name: AccountName, emailFallback: string): string => {
  const given = present(name.givenName);
  const family = present(name.familyName);

  if (given && family) return `${given} ${family}`;
  return given ?? family ?? emailFallback;
};

/**
 * The monogram beside it — the first character of each part present, folded to upper case.
 *
 * **Returns `null` rather than an initial from the address**, and that is UX-137's instruction
 * rather than an omission: a letter taken from an email address reads as a name the person did not
 * give, where an absent monogram lets the surface show its glyph and say nothing false. The
 * account menu's docblock predicted exactly this shape.
 *
 * `Array.from` rather than `[0]`, because a JavaScript string indexes by UTF-16 code unit and a
 * name may open with a character outside the basic plane — taking `[0]` there yields half a
 * surrogate pair, which renders as a replacement glyph.
 */
export const monogram = (name: AccountName): string | null => {
  const initial = (part: string | null) => {
    const value = present(part);
    return value ? (Array.from(value)[0]?.toLocaleUpperCase() ?? null) : null;
  };

  const parts = [initial(name.givenName), initial(name.familyName)].filter(
    (character): character is string => character !== null,
  );
  return parts.length > 0 ? parts.join('') : null;
};
