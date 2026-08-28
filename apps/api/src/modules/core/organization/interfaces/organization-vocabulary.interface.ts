/**
 * The two configuration vocabularies the organization aggregate is validated against (AD-4, §7.2).
 *
 * **In `interfaces/` behind a token rather than injected as `ConfigurationStore`**, because the use
 * cases must not import an infrastructure service to compile — the dependency rule points inward,
 * and a use case reaching for a polling cache is the shape that makes "no database in a use-case
 * test" untrue. What crosses this port is two lists of strings.
 */
export interface OrganizationVocabulary {
  /**
   * The legal forms registered for a country, or **`null` when that country registers none**.
   *
   * The distinction is the whole contract. `null` means *the platform does not yet operate here* —
   * §7.2's stated consequence of scoping the vocabulary by country, reversible with one
   * configuration entry and no redeploy. An empty array would mean *we operate here and no form is
   * permitted*, which is a misconfiguration rather than a boundary, and collapsing the two would
   * make an editing mistake indistinguishable from a deliberate limit.
   */
  legalFormsFor(countryCode: string): readonly string[] | null;

  /**
   * The countries that register a legal-form vocabulary — which is exactly the set of countries an
   * organization may be created in (§7.2), so S-04's country select is built from this and not from
   * ISO's 249.
   *
   * Lower case, as the configuration scope spells it; the caller renders it however ISO does.
   */
  registeredCountries(): readonly string[];

  /**
   * FR-14's organization types, `direct_sme` alone at MVP.
   *
   * NFR-9's obligation lands precisely here: a fourth type must be admitted by **registering data**,
   * so this list is read at request time and never mirrored as an `as const`. Empty when nothing is
   * registered — fail-closed, since a relationship of an unregistered type is what the requirement
   * is about.
   */
  relationshipTypes(): readonly string[];
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ORGANIZATION_VOCABULARY = Symbol('ORGANIZATION_VOCABULARY');
