/**
 * Which sections a report has declared omitted, and which modules that makes omitted (task 36.13).
 *
 * **VSME's only omission ground** — ¶19, *"when the provision of the disclosures in this Standard
 * requires disclosing classified or sensitive information, the undertaking may omit such
 * information"* — stated in B1 as ¶24(b) requires. There is no materiality ground: ¶21 says
 * undertakings *shall report* B1–B11, and the standard carries no materiality assessment at all.
 *
 * Pure, so the derivation is a unit spec rather than something only a browser can reach.
 */

/** The element the declaration is stored in — a B1 `enumeration_set` over the 51-section domain. */
export const OMITTED_DISCLOSURES_ELEMENT =
  'ListOfOmittedDisclosuresDeemedToBeClassifiedOrSensitiveInformation';

/**
 * The module a member belongs to, or `null` for the four that belong to none.
 *
 * **The structure is in the key and is read as a shape**, which is task 91.4's rule for exactly this
 * kind of parse: `B1-BasisForPreparationMember` is B1's *module-level* entry — the hyphen after the
 * code is what marks it — and `B1ListOfSubsidiariesMember` is a section within it. The four members
 * matching neither are the *any other / entity-specific* disclosures, which sit under no module and
 * are correctly nobody's.
 */
export function moduleOfOmissionMember(member: string): { module: string; section: boolean } | null {
  // **The stored form is taxonomy-qualified** — `vsme:B7-…Member` — because an enumeration answer is
  // written as the member's qualified name, which is what the export must emit (task 91.1). The
  // prefix is optional here so the domain's own raw keys read too, and both reach this one parse
  // rather than each caller remembering which form it holds.
  const match = /^(?:[a-z0-9]+:)?([BC]\d+)(-)?/.exec(member);
  if (match === null) return null;
  return { module: match[1], section: match[2] === undefined };
}

/**
 * The modules a report has declared omitted, from the members it has selected.
 *
 * **A module is omitted when its own member is selected, or when every one of its sections is.**
 * The second half is EFRAG's own derivation — the template computes each module checkbox as
 * `COUNTIF(sections, TRUE) = ROWS(sections)` — generalised, and it is generalised deliberately
 * rather than copied: **the template's B7 formula reads `D34:D35` while B7 has three section
 * checkboxes at rows 33, 34 and 35**, so under EFRAG's own rule a reporter who omits the last two
 * gets a module marked omitted while B7's circular-economy description is still being answered.
 * That would put a false statement in a filing, so the platform requires all of them
 * (`architecture.md` §12.5.6; the same shape as B6's divergence at task 36.7).
 *
 * **A module with no sections is its own member and nothing else** — B4, B9 and B11, which EFRAG
 * draws as a single checkbox for the same reason.
 */
export function omittedModules(input: {
  readonly selected: readonly string[];
  /** Every member of the domain, so *all of its sections* is a claim about the standard's list. */
  readonly domain: readonly string[];
}): ReadonlySet<string> {
  const sectionsOf = new Map<string, string[]>();
  for (const member of input.domain) {
    const parsed = moduleOfOmissionMember(member);
    if (parsed === null || !parsed.section) continue;
    const known = sectionsOf.get(parsed.module) ?? [];
    known.push(bare(member));
    sectionsOf.set(parsed.module, known);
  }

  // **Compared bare, because the two sides arrive in different forms**: the domain carries the
  // registry's raw keys and the selection carries what the store holds, which is qualified. Matching
  // them as given is the defect this line exists to prevent — and it passed an api test that had
  // fabricated the unqualified form rather than writing one the way the browser does.
  const chosen = new Set(input.selected.map(bare));
  const omitted = new Set<string>();
  for (const member of chosen) {
    const parsed = moduleOfOmissionMember(member);
    if (parsed !== null && !parsed.section) omitted.add(parsed.module);
  }
  for (const [module, sections] of sectionsOf) {
    // `every` over a non-empty list: a module the domain gives no sections is not vacuously omitted,
    // which is why the map is built from sections alone and never seeded with the module entry.
    if (sections.every((section) => chosen.has(section))) omitted.add(module);
  }
  return omitted;
}

/** A member without its taxonomy prefix. The one place the two forms are reconciled. */
const bare = (member: string): string => member.slice(member.indexOf(':') + 1);
