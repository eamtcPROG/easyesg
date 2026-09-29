import type { Organization, UpdateOrganizationRequest } from '@easyesg/contracts';

/**
 * S-15's form shape, and the two conversions between it and the wire (FR-15). FR-16's identifiers were here until
 * task 175 moved them to each reporting entity, and S-13's form.
 *
 * **Every field is a string, including the ones the API models as nullable** — an input has no
 * `null`, and `''` is what "the reader cleared it" looks like in a DOM. The conversion back to
 * `null` happens exactly once, in `toPatch`, so nothing downstream has to know.
 *
 * **In `tools/` since task 129, which is what made the pair testable.** Both directions used to sit
 * inside the form — `toFields` as a module constant, the patch as an object literal built inside the
 * submit handler — so the one invariant that matters here, *`''` and `null` are the same absence and
 * round-trip to each other*, could only be exercised by driving a browser through thirteen fields.
 * It is a unit spec now.
 */
export interface ProfileFields {
  name: string;
  countryCode: string;
  legalForm: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredLocality: string;
  registeredPostalCode: string;
  contactEmail: string;
  contactPhone: string;
  reportContactName: string;
  reportContactEmail: string;
}

/**
 * Field-level shape, carrying no business meaning — which is the line `apps/web/CLAUDE.md` draws
 * for what may live in a form at all; this only decides whether a string is worth evaluating.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `null` clears a field on the API; `''` is not a value it accepts for any of them. */
const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

/** The stored record as the form holds it — every absence becomes `''`. */
export const toFields = (organization: Organization): ProfileFields => ({
  name: organization.name,
  countryCode: organization.countryCode,
  legalForm: organization.legalForm ?? '',
  registeredAddressLine1: organization.registeredAddressLine1 ?? '',
  registeredAddressLine2: organization.registeredAddressLine2 ?? '',
  registeredLocality: organization.registeredLocality ?? '',
  registeredPostalCode: organization.registeredPostalCode ?? '',
  contactEmail: organization.contactEmail ?? '',
  contactPhone: organization.contactPhone ?? '',
  reportContactName: organization.reportContactName ?? '',
  reportContactEmail: organization.reportContactEmail ?? '',
});

/** What the form sends — every absence becomes `null` again. */
export const toPatch = (fields: ProfileFields): UpdateOrganizationRequest => ({
  name: fields.name.trim(),
  countryCode: fields.countryCode,
  legalForm: orNull(fields.legalForm),
  registeredAddressLine1: orNull(fields.registeredAddressLine1),
  registeredAddressLine2: orNull(fields.registeredAddressLine2),
  registeredLocality: orNull(fields.registeredLocality),
  registeredPostalCode: orNull(fields.registeredPostalCode),
  contactEmail: orNull(fields.contactEmail),
  contactPhone: orNull(fields.contactPhone),
  reportContactName: orNull(fields.reportContactName),
  reportContactEmail: orNull(fields.reportContactEmail),
});
