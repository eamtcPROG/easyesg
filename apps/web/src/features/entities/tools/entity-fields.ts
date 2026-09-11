import type { CreateReportingEntityRequest, NaceCodeMatch, ReportingEntity } from '@easyesg/contracts';
import type { ConsolidationBasis } from './entities';

/**
 * The record's form shape and the two conversions between it and the wire — pure, so both are unit
 * specs (task 134, cut out of a 426-line form on S-15's precedent).
 *
 * **Sites and consolidation members are whole-collection saves**, because that is the API's own
 * semantics: a member with an id is edited, one without is added, and a stored member the array
 * omits is removed. So the form holds both lists and sends what it holds — a per-row write would
 * have to invent an ordering between "add" and "remove" that the endpoint does not have.
 *
 * **The consolidation basis is null until stated**, which VSME asks explicitly, so there is no
 * default answering it on the undertaking's behalf (FR-19): `''` in the form is the unstated case
 * and `null` is what it sends.
 */
export interface SiteFields {
  id?: string;
  name: string;
  addressLine1: string;
  locality: string;
  postalCode: string;
}

export interface MemberFields {
  id?: string;
  name: string;
  idno: string;
  countryCode: string;
}

export interface EntityFields {
  name: string;
  legalForm: string;
  consolidationBasis: string;
  sites: SiteFields[];
  consolidationMembers: MemberFields[];
}

/** A row the reporter has just added — no id, and the store learns of it when the save does. */
export const EMPTY_SITE: SiteFields = { name: '', addressLine1: '', locality: '', postalCode: '' };
export const EMPTY_MEMBER: MemberFields = { name: '', idno: '', countryCode: '' };

const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

export const toFields = (entity: ReportingEntity | null): EntityFields => ({
  name: entity?.name ?? '',
  legalForm: entity?.legalForm ?? '',
  consolidationBasis: entity?.consolidationBasis ?? '',
  sites: (entity?.sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    addressLine1: site.addressLine1 ?? '',
    locality: site.locality ?? '',
    postalCode: site.postalCode ?? '',
  })),
  consolidationMembers: (entity?.consolidationMembers ?? []).map((member) => ({
    id: member.id,
    name: member.name,
    idno: member.idno ?? '',
    countryCode: member.countryCode ?? '',
  })),
});

/**
 * The request the form sends: trimmed, blanks as `null`, a new row without an id.
 *
 * The activity codes arrive beside the fields rather than inside them: a `useFieldArray` of codes
 * would put the words in form state where nothing edits them, so the form tracks the list on its
 * own and hands it here.
 */
export const toRequest = (
  fields: EntityFields,
  codes: readonly NaceCodeMatch[],
): CreateReportingEntityRequest => ({
  name: fields.name.trim(),
  legalForm: orNull(fields.legalForm),
  naceCodes: codes.map((code) => code.code),
  consolidationBasis:
    fields.consolidationBasis === '' ? null : (fields.consolidationBasis as ConsolidationBasis),
  sites: fields.sites.map((site) => ({
    ...(site.id ? { id: site.id } : {}),
    name: site.name.trim(),
    addressLine1: orNull(site.addressLine1),
    locality: orNull(site.locality),
    postalCode: orNull(site.postalCode),
  })),
  consolidationMembers: fields.consolidationMembers.map((member) => ({
    ...(member.id ? { id: member.id } : {}),
    name: member.name.trim(),
    idno: orNull(member.idno),
    countryCode: orNull(member.countryCode),
  })),
});
