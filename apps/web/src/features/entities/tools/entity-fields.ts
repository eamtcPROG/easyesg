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
 * **A row the store holds is marked `removed` rather than dropped** (project owner, 28 Sep 2026): the reader sees it
 * collapse to a line they can undo, and it leaves the store only with the save. So the flag is form state — a discard
 * restores it and `isDirty` sees it — and `toRequest` is where a removed row stops existing. A row added since the last
 * save has nothing to keep, and the form drops it outright.
 *
 * **The identifiers are the entity's since task 175** (FR-16 as amended): the IDNO and an optional LEI, blanks sent
 * as `null` — which clears a stored one — and the LEI upper-cased.
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
  removed: boolean;
}

export interface MemberFields {
  id?: string;
  name: string;
  idno: string;
  countryCode: string;
  removed: boolean;
}

export interface EntityFields {
  name: string;
  legalForm: string;
  idno: string;
  lei: string;
  consolidationBasis: string;
  sites: SiteFields[];
  consolidationMembers: MemberFields[];
}

/** A row the reporter has just added — no id, and the store learns of it when the save does. */
export const EMPTY_SITE: SiteFields = { name: '', addressLine1: '', locality: '', postalCode: '', removed: false };
export const EMPTY_MEMBER: MemberFields = { name: '', idno: '', countryCode: '', removed: false };

const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

/** A row the reader has not removed — the only kind a save sends. */
const kept = (row: { readonly removed: boolean }): boolean => !row.removed;

export const toFields = (entity: ReportingEntity | null): EntityFields => ({
  name: entity?.name ?? '',
  legalForm: entity?.legalForm ?? '',
  idno: entity?.idno ?? '',
  lei: entity?.lei ?? '',
  consolidationBasis: entity?.consolidationBasis ?? '',
  sites: (entity?.sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    addressLine1: site.addressLine1 ?? '',
    locality: site.locality ?? '',
    postalCode: site.postalCode ?? '',
    removed: false,
  })),
  consolidationMembers: (entity?.consolidationMembers ?? []).map((member) => ({
    id: member.id,
    name: member.name,
    idno: member.idno ?? '',
    countryCode: member.countryCode ?? '',
    removed: false,
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
  idno: orNull(fields.idno),
  // Upper-cased because the API stores the canonical form, and a record re-seeded from its answer must not read as
  // changed — S-15's reason while the field was its (task 175 moved it here).
  lei: orNull(fields.lei)?.toUpperCase() ?? null,
  naceCodes: codes.map((code) => code.code),
  consolidationBasis:
    fields.consolidationBasis === '' ? null : (fields.consolidationBasis as ConsolidationBasis),
  sites: fields.sites.filter(kept).map((site) => ({
    ...(site.id ? { id: site.id } : {}),
    name: site.name.trim(),
    addressLine1: orNull(site.addressLine1),
    locality: orNull(site.locality),
    postalCode: orNull(site.postalCode),
  })),
  consolidationMembers: fields.consolidationMembers.filter(kept).map((member) => ({
    ...(member.id ? { id: member.id } : {}),
    name: member.name.trim(),
    idno: orNull(member.idno),
    countryCode: orNull(member.countryCode),
  })),
});
