/**
 * What the platform already knows and will not re-request (task 91.2; FR-27, UX-109, D-2).
 *
 * **B1's elements that the entity record or the report itself already answers**, by name. These are
 * EFRAG's element keys, pinned here rather than read from anywhere, and `entity-defaults.spec.ts`
 * asserts each against both registered versions' artefacts — so a release that renames one fails a
 * hermetic spec rather than quietly pre-filling nothing.
 */
export const B1_ELEMENT = {
  BASIS_FOR_PREPARATION: 'BasisForPreparation',
  BASIS_FOR_REPORTING: 'BasisForReporting',
  LEGAL_FORM: 'UndertakingsLegalForm',
  ACTIVITY_CODES: 'NaceSectorClassificationCodes',
  SITE_ADDRESS: 'AddressOfSite',
  SITE_POSTAL_CODE: 'PostalCodeOfSite',
  SITE_CITY: 'CityOfSite',
  SITE_COUNTRY: 'CountryOfSite',
  SITE_GPS: 'GPSLocationOfSite',
  SUBSIDIARY_NAME: 'NameOfTheSubsidiary',
} as const;

/**
 * Every key the record or the report's scope answers in B1 — stored under any of them, B1 has been opened (task 180.2).
 *
 * **Opening B1 commits every default it shows at once** (task 36.2), and `BasisForPreparation` always has one, from the
 * report's scope — so a report holding none of these has never had B1 opened, and one holding any has. That is the
 * moment FR-27, as amended 30 Sep 2026, stops the snapshot following the entity. **In a model rather than beside
 * `entityDefaults`** since then, because the period store reads it and an adapter reads a module's vocabulary, never
 * its use cases.
 */
export const RECORD_ANSWERED_ELEMENTS: readonly string[] = Object.values(B1_ELEMENT);
