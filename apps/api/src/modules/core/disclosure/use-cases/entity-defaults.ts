import { ENUMERATION_TAXONOMY, type RegisteredTaxonomy } from '@api/contracts/taxonomy-registry.port';
import {
  CONSOLIDATION_BASIS,
  type ConsolidationBasis,
} from '@api/modules/core/entity/models/reporting-entity.model';
import type { EntitySnapshot } from '../models/entity-snapshot.model';
import { REPORT_SCOPE, type ReportScope } from '../models/report.model';
import type { DisclosureDefault } from '../models/wizard-step.model';

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

/** The domains those choice fields draw from, qualified as the registry keys them (task 91.1). */
export const B1_DOMAIN = {
  BASIS_FOR_PREPARATION: `${ENUMERATION_TAXONOMY.VSME}:BasisForPreparationMember`,
  BASIS_FOR_REPORTING: `${ENUMERATION_TAXONOMY.VSME}:BasisForReportingMember`,
  LEGAL_FORM: `${ENUMERATION_TAXONOMY.VSME}:ListOfUndertakingsLegalFormsMember`,
  ACTIVITY_CODES: `${ENUMERATION_TAXONOMY.NACE}:NACE_AllEconomicActivitiesNAMember`,
} as const;

/**
 * D-A's scope flag is EFRAG's *basis for preparation*: Option A is the Basic Module alone, Option B
 * the Basic and Comprehensive Modules together. The report already carries it (task 31.3), so the
 * field opens answered — the one default whose source is the report rather than the snapshot
 * (architecture.md §12.5.6, task 91.2's row).
 */
export const SCOPE_MEMBER: Readonly<Record<ReportScope, string>> = {
  [REPORT_SCOPE.BASIC]: 'OptionABasicModuleOnlyMember',
  [REPORT_SCOPE.BASIC_AND_COMPREHENSIVE]: 'OptionBBasicModuleAndComprehensiveModuleMember',
};

/** FR-19's boundary, in EFRAG's words. */
export const BASIS_MEMBER: Readonly<Record<ConsolidationBasis, string>> = {
  [CONSOLIDATION_BASIS.INDIVIDUAL]: 'IndividualMember',
  [CONSOLIDATION_BASIS.CONSOLIDATED]: 'ConsolidatedMember',
};

export interface EntityDefaultsInput {
  readonly registered: RegisteredTaxonomy;
  /** Null for a period opened before task 31.1 took snapshots; nothing but the scope is defaulted then. */
  readonly snapshot: EntitySnapshot | null;
  readonly scope: ReportScope;
  /**
   * The member the entity's legal form discloses as, resolved by the caller from the country's
   * configuration (`OrganizationVocabulary.legalFormMemberFor`); `null` where the form maps to
   * nothing, in which case the field opens empty and the reporter chooses.
   */
  readonly legalFormMember: string | null;
}

/**
 * Defaults by element key, then by ordinal.
 *
 * **A list per element rather than one value**, because sites and subsidiaries are repeating groups:
 * the snapshot's *n* sites are *n* rows of each site element, in the snapshot's order, and a row
 * whose site lacks that field holds `null` — the row exists, its default does not.
 */
export type EntityDefaults = ReadonlyMap<string, readonly (DisclosureDefault | null)[]>;

const NO_DEFAULT: DisclosureDefault = {
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
};

/** Every B1 default is text: a member's qualified name, or a site's own words. */
const text = (value: string | null): DisclosureDefault | null =>
  value === null ? null : { ...NO_DEFAULT, valueText: value };

/**
 * The member's qualified name **if the pinned version declares it**, else nothing.
 *
 * A member pinned in this file and absent from the report's own version would pre-fill an answer
 * that version cannot store — so the domain is consulted per report, and a mismatch is an empty
 * field rather than a wrong one. DR-4 at the default boundary.
 */
function memberOf(
  registered: RegisteredTaxonomy,
  input: { readonly domain: string; readonly member: string },
): string | null {
  const enumeration = registered.enumerations.find((candidate) => candidate.key === input.domain);
  if (enumeration === undefined) return null;
  return enumeration.members.some((member) => member.key === input.member)
    ? `${enumeration.taxonomy}:${input.member}`
    : null;
}

/**
 * The entity's activity codes as the members that carry them (architecture.md §12.5.6, task 91.1's
 * NACE row). **A code with no member is left out, not refused** — the owner's decision on task
 * 91.2: the reporter sees the members that map and adds the rest from the picker, which offers all
 * 1 047. The dropped codes are named in the result so the caller can log them, since a silent
 * drop is the failure the Rev. 2 / Rev. 2.1 assumption row warns about.
 */
function activityCodes(
  registered: RegisteredTaxonomy,
  codes: readonly string[],
): { readonly value: string | null; readonly unmapped: readonly string[] } {
  const enumeration = registered.enumerations.find((candidate) => candidate.key === B1_DOMAIN.ACTIVITY_CODES);
  if (enumeration === undefined) return { value: null, unmapped: [...codes] };
  const byCode = new Map(
    enumeration.members.flatMap((member) => (member.code === null ? [] : [[member.code, member.key] as const])),
  );
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const code of codes) {
    const key = byCode.get(code);
    if (key === undefined) unmapped.push(code);
    else mapped.push(`${enumeration.taxonomy}:${key}`);
  }
  // An `enumeration_set` stores its chosen members space-separated (task 91.1).
  return { value: mapped.length === 0 ? null : mapped.join(' '), unmapped };
}

/** `country:MD` — the qualified form the country domain's options take (task 91.1). */
const country = (code: string | null): string | null =>
  code === null ? null : `${ENUMERATION_TAXONOMY.COUNTRY}:${code.toUpperCase()}`;

/** A site's coordinates as one string, EFRAG's element being a string; nothing where either is unset. */
const gps = (site: { readonly latitude: string | null; readonly longitude: string | null }): string | null =>
  site.latitude === null || site.longitude === null ? null : `${site.latitude}, ${site.longitude}`;

/**
 * B1's defaults from what is already known (UC-19 step 1: *"confirms or completes"*).
 *
 * **Pure, so every mapping is a unit spec.** Nothing here reads a store or a clock; the use case
 * hands in the pinned taxonomy, the snapshot and the report's scope, and gets back what each field
 * would hold if the reporter accepted it. What the reporter does with that is task 36.2's — the
 * client commits a default on blur or step change exactly as it commits a typed value (UX-34), so
 * the store holds nothing until then and the entity is never written by this path (D-2).
 */
export function entityDefaults(input: EntityDefaultsInput): {
  readonly defaults: EntityDefaults;
  /** Activity codes the pinned version's NACE domain has no member for — for the caller's log. */
  readonly unmappedActivityCodes: readonly string[];
} {
  const { registered, snapshot, scope } = input;
  const defaults = new Map<string, readonly (DisclosureDefault | null)[]>();
  const scalar = (key: string, value: string | null): void => {
    if (value !== null) defaults.set(key, [text(value)]);
  };

  scalar(
    B1_ELEMENT.BASIS_FOR_PREPARATION,
    memberOf(registered, { domain: B1_DOMAIN.BASIS_FOR_PREPARATION, member: SCOPE_MEMBER[scope] }),
  );
  if (snapshot === null) return { defaults, unmappedActivityCodes: [] };

  scalar(
    B1_ELEMENT.LEGAL_FORM,
    input.legalFormMember === null
      ? null
      : memberOf(registered, { domain: B1_DOMAIN.LEGAL_FORM, member: input.legalFormMember }),
  );
  scalar(
    B1_ELEMENT.BASIS_FOR_REPORTING,
    snapshot.consolidationBasis === null
      ? null
      : memberOf(registered, {
          domain: B1_DOMAIN.BASIS_FOR_REPORTING,
          member: BASIS_MEMBER[snapshot.consolidationBasis],
        }),
  );
  const codes = activityCodes(registered, snapshot.naceCodes);
  scalar(B1_ELEMENT.ACTIVITY_CODES, codes.value);

  if (snapshot.sites.length > 0) {
    defaults.set(B1_ELEMENT.SITE_ADDRESS, snapshot.sites.map((site) => text(site.addressLine1)));
    defaults.set(B1_ELEMENT.SITE_POSTAL_CODE, snapshot.sites.map((site) => text(site.postalCode)));
    defaults.set(B1_ELEMENT.SITE_CITY, snapshot.sites.map((site) => text(site.locality)));
    defaults.set(B1_ELEMENT.SITE_COUNTRY, snapshot.sites.map((site) => text(country(site.countryCode))));
    defaults.set(B1_ELEMENT.SITE_GPS, snapshot.sites.map((site) => text(gps(site))));
  }

  // B1 reads the basis first and the list only when it says `consolidated` (the entity model's own
  // rule): an inert list under `individual` is master data, not a disclosure.
  if (snapshot.consolidationBasis === CONSOLIDATION_BASIS.CONSOLIDATED && snapshot.consolidationMembers.length > 0) {
    defaults.set(B1_ELEMENT.SUBSIDIARY_NAME, snapshot.consolidationMembers.map((member) => text(member.name)));
  }

  return { defaults, unmappedActivityCodes: codes.unmapped };
}
