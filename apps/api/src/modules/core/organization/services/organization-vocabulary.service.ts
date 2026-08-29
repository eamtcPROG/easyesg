import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  NACE_CODE_CONFIG_KIND,
  ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
  ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND,
  ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE,
} from '../constants/organization.constants';
import type { NaceCode, OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * `OrganizationVocabulary` over the configuration store — the adapter half of AD-4 for FR-14's
 * organization types and FR-15's legal forms.
 *
 * **Validated, never cast**, following `SocialProviderCatalogService`: configuration is data a
 * person edits through A-18, so a malformed payload must surface as "no vocabulary registered" plus
 * an operator-facing log line. Cast instead, a payload of `{"forms": "srl"}` would spread into
 * seven single-character forms and admit `s` as a legal form — a wrong answer that looks like a
 * working one.
 *
 * **A malformed payload fails closed, and that is not the same choice as the provider catalogue's.**
 * There, an unavailable provider removes one sign-in button and the others still work. Here, a
 * legal-form vocabulary that read as empty would refuse every profile save for that country — so
 * the two behave alike (return nothing, log loudly) but for opposite reasons, and the noisy log is
 * doing more work in this one.
 */
@Injectable()
export class OrganizationVocabularyService implements OrganizationVocabulary {
  private readonly logger = new Logger(OrganizationVocabularyService.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  legalFormsFor(countryCode: string): readonly string[] | null {
    // Lower case, because the scope is the seed file's own segment and `organization-legal-form.
    // MD.json` is not a filename anybody writes. The column holds the code upper case (ISO's own
    // rendering), so exactly one of the two has to convert and this is the boundary where it does.
    const entry = this.configurationStore.get({
      kind: ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
      scope: countryCode.toLowerCase(),
    });
    if (!entry) return null;

    const forms = entry.payload.forms;
    if (!isStringArray(forms)) {
      this.logger.error(
        `Configuration entry ${ORGANIZATION_LEGAL_FORM_CONFIG_KIND}/${countryCode.toLowerCase()} ` +
          `(revision ${entry.revision}) is malformed; treating the country as unsupported`,
      );
      return null;
    }
    return forms;
  }

  registeredLegalForms(): readonly { countryCode: string; legalForms: readonly string[] }[] {
    // One pass: the payloads are already in hand here, so the forms travel with the scope rather
    // than sending the caller back through `legalFormsFor` to rescan and re-validate what this
    // filter just read.
    //
    // A malformed payload is excluded rather than logged again — `legalFormsFor` logs it once with
    // its revision when somebody asks for that country directly. Offering S-04 a country whose
    // vocabulary cannot be read would be a choice that refuses on submit.
    return this.configurationStore
      .list({ kind: ORGANIZATION_LEGAL_FORM_CONFIG_KIND })
      .flatMap((entry) =>
        isStringArray(entry.payload.forms)
          ? [{ countryCode: entry.scope, legalForms: entry.payload.forms }]
          : [],
      )
      .sort((a, b) => (a.countryCode < b.countryCode ? -1 : a.countryCode > b.countryCode ? 1 : 0));
  }

  /**
   * **Cached per configuration revision**, because the payload is 996 entries and a request that
   * validates several codes would otherwise rebuild the set for each one. Keyed on the revision, so
   * a publication invalidates it without any invalidation logic: a new revision is a new key.
   */
  private naceCache = new Map<
    string,
    { revision: number; codes: ReadonlySet<string>; classifier: readonly NaceCode[] }
  >();

  /**
   * Reads and validates the classifier payload once, for both readers below.
   *
   * **A malformed payload fails closed and logs once**, as the legal-form vocabulary does — an
   * entity write would then admit no code for the country, which is loud rather than silent. The
   * per-entry check is `Record<string, string>` because a label that is not a string would reach a
   * screen as `[object Object]`, and an entry whose labels are unreadable is dropped rather than
   * failing the whole classifier: one bad row must not remove 995 good ones from the picker.
   */
  private readNaceEntry(
    scope: string,
  ): { codes: ReadonlySet<string>; classifier: readonly NaceCode[] } | null {
    const entry = this.configurationStore.get({ kind: NACE_CODE_CONFIG_KIND, scope });
    if (!entry) return null;

    const cached = this.naceCache.get(scope);
    if (cached?.revision === entry.revision) return cached;

    const codes = entry.payload.codes;
    if (typeof codes !== 'object' || codes === null || Array.isArray(codes)) {
      this.logger.error(
        `Configuration entry ${NACE_CODE_CONFIG_KIND}/${scope} (revision ${entry.revision}) is ` +
          `malformed; no activity code will be admitted for this country`,
      );
      return null;
    }

    const classifier: NaceCode[] = [];
    // Narrowed before it is walked: `payload.codes` is `unknown` by the store's contract, and the
    // shape check above proves only that it is a non-array object. Entering it as `Record<string,
    // unknown>` is what keeps every value below a thing to test rather than an `any` to trust.
    for (const [code, labels] of Object.entries(codes as Record<string, unknown>)) {
      if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) continue;
      const readable = Object.entries(labels).filter(
        (pair): pair is [string, string] => typeof pair[1] === 'string',
      );
      if (readable.length === 0) continue;
      classifier.push({ code, labels: Object.fromEntries(readable) });
    }

    // Code order, once, here — so neither reader sorts and the picker's ordering is the
    // classifier's own hierarchy rather than whatever `Object.entries` happened to yield.
    classifier.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

    const value = { codes: new Set(Object.keys(codes)) as ReadonlySet<string>, classifier };
    this.naceCache.set(scope, { revision: entry.revision, ...value });
    return value;
  }

  naceCodesFor(countryCode: string): ReadonlySet<string> | null {
    return this.readNaceEntry(countryCode.toLowerCase())?.codes ?? null;
  }

  naceClassifierFor(countryCode: string): readonly NaceCode[] | null {
    return this.readNaceEntry(countryCode.toLowerCase())?.classifier ?? null;
  }

  relationshipTypes(): readonly string[] {
    const entry = this.configurationStore.get({
      kind: ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND,
      scope: ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE,
    });
    if (!entry) return [];

    const types = entry.payload.types;
    if (!isStringArray(types)) {
      this.logger.error(
        `Configuration entry ${ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND}/` +
          `${ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE} (revision ${entry.revision}) is ` +
          `malformed; no relationship type will be admitted`,
      );
      return [];
    }
    return types;
  }
}
