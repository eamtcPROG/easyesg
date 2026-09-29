import type { Organization, UpdateOrganizationRequest } from '@easyesg/contracts';

/**
 * S-15's form shape, and the two conversions between it and the wire (FR-15) — **the account's four fields**: its
 * name, its country and how the platform reaches it. What a report prints is each reporting entity's, on S-13: the
 * identifiers since task 175, and the legal form, the registered address and the report contact since task 177.
 *
 * **Every field is a string, including the ones the API models as nullable** — an input has no
 * `null`, and `''` is what "the reader cleared it" looks like in a DOM. The conversion back to
 * `null` happens exactly once, in `toPatch`, so nothing downstream has to know.
 *
 * **In `tools/` since task 129, which is what made the pair testable.** Both directions used to sit
 * inside the form — `toFields` as a module constant, the patch as an object literal built inside the
 * submit handler — so the one invariant that matters here, *`''` and `null` are the same absence and
 * round-trip to each other*, could only be exercised by driving a browser through every field. It is a unit spec now.
 */
export interface ProfileFields {
  name: string;
  countryCode: string;
  contactEmail: string;
  contactPhone: string;
}

/** `null` clears a field on the API; `''` is not a value it accepts for any of them. */
const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

/** The stored record as the form holds it — every absence becomes `''`. */
export const toFields = (organization: Organization): ProfileFields => ({
  name: organization.name,
  countryCode: organization.countryCode,
  contactEmail: organization.contactEmail ?? '',
  contactPhone: organization.contactPhone ?? '',
});

/** What the form sends — every absence becomes `null` again. */
export const toPatch = (fields: ProfileFields): UpdateOrganizationRequest => ({
  name: fields.name.trim(),
  countryCode: fields.countryCode,
  contactEmail: orNull(fields.contactEmail),
  contactPhone: orNull(fields.contactPhone),
});
