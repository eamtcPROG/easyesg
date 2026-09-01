/**
 * `@easyesg/vsme` — the taxonomy model and the generated typed facade (AD-3, T-3).
 *
 * **What it is not.** The taxonomy itself is configuration in the store (AD-4, task 33.1) and its
 * wording is committed catalogues (OQ-43, task 33.2). This package holds neither. It holds the
 * *typing* the element-keyed store gave up, generated per version from the registered artefact, so
 * a caller writes a descriptor the compiler supplies rather than an element key it can misspell.
 */
export { COLUMN_OF_KIND, DISCLOSURE_KIND, VALUE_COLUMN } from './shape.js';
export type {
  Dimensioned,
  Disclosure,
  DisclosureKind,
  Holds,
  HoldsOf,
  RepeatingGroup,
  Scalar,
  ValueColumn,
  ValueOf,
} from './shape.js';
export { DISCLOSURES, TAXONOMY_VERSION } from './generated/2026-05-01.js';
