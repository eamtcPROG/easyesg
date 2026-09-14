/**
 * `true` only while `A` and `B` are the same set: each extends the other.
 *
 * What every consumer-side mirror of an api vocabulary is held to the generated wire enum with — declared as
 * `const X_MIRRORS_WIRE: SameSet<Mirror, Wire> = true`, which stops type-checking the moment either side gains,
 * loses or renames a member. **Its own module since task 67.9**, when support access's vocabularies became the
 * second file that needed it; it had been private to `admin.ts`.
 */
export type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
