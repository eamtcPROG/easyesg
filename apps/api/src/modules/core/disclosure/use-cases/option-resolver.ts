import type { DisclosureLabel, Locale } from '@easyesg/i18n';
import { DISCLOSURE_KIND } from '@easyesg/vsme';
import {
  ENUMERATION_TAXONOMY,
  type RegisteredTaxonomy,
  type TaxonomyElement,
  type TaxonomyEnumeration,
  type TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { PUBLISHED_CLASSIFICATION_LOCALE, VOCABULARY_COUNTRY } from '../constants/classification.constants';
import { qualifiedDomainOf } from '../domain/qualified-domain';
import type { DisclosureOption } from '../models/wizard-step.model';

/**
 * The two operations of the vocabulary port the options read — a `Pick`, so this resolver depends on no operation it
 * never calls (CLAUDE.md, Interface Segregation), and a spec fakes two methods.
 */
export type OptionVocabulary = Pick<OrganizationVocabulary, 'registeredLegalForms' | 'naceClassifierFor'>;

/**
 * The answers a choice field offers, per domain (task 91.1).
 *
 * **Three sources, one shape.** A `vsme` domain's members are wording in the catalogues, in the
 * request's locale with the catalogue's standing. NACE's members come from the classification the
 * package ships — English is EFRAG's — and their Romanian and Russian names from the platform's own
 * CAEM classifier by pointed code, which is why the artefact carries `01.11` and not `NACE_A0111`.
 * The country domain is ISO 3166, which the package only references: the members are the countries
 * the platform registers a vocabulary for, and their names are the client's catalogue's, so `label`
 * is `null` there rather than an English word for a Russian reader.
 *
 * **Each domain is resolved once per step**, not once per field: a step can name the same domain
 * from several elements (B1 has two `ListOfDisclosuresMember` fields), and NACE is 1 047 members.
 *
 * **Beside the use case rather than in `domain/`, because it reads two ports** — the registry's enumerations and the
 * organization's vocabularies — and keeps what it read for the one step read it lives for.
 */
export class OptionResolver {
  private readonly cache = new Map<string, readonly DisclosureOption[]>();

  constructor(
    private readonly input: {
      readonly registered: Pick<RegisteredTaxonomy, 'standard' | 'version'>;
      readonly taxonomy: Pick<TaxonomyRegistry, 'enumeration'>;
      readonly memberLabels: Readonly<Record<string, DisclosureLabel>> | null;
      readonly vocabulary: OptionVocabulary;
      readonly locale: Locale;
    },
  ) {}

  optionsFor(element: TaxonomyElement): readonly DisclosureOption[] | null {
    if (element.kind !== DISCLOSURE_KIND.ENUMERATION && element.kind !== DISCLOSURE_KIND.ENUMERATION_SET) {
      return null;
    }
    const key = qualifiedDomainOf(element);
    if (key === null) return [];
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const enumeration = this.input.taxonomy.enumeration({
      standard: this.input.registered.standard,
      version: this.input.registered.version,
      key,
    });
    const resolved = enumeration === null ? [] : this.resolve(enumeration);
    this.cache.set(key, resolved);
    return resolved;
  }

  private resolve(enumeration: TaxonomyEnumeration): readonly DisclosureOption[] {
    const qualify = (member: string): string => `${enumeration.taxonomy}:${member}`;

    if (enumeration.taxonomy === ENUMERATION_TAXONOMY.COUNTRY) {
      // ISO 3166: the countries the platform registers, named by the client's own catalogue.
      return this.input.vocabulary
        .registeredLegalForms()
        .map(({ countryCode }) => ({
          value: qualify(countryCode.toUpperCase()),
          label: null,
          code: countryCode.toUpperCase(),
          // `null`, not `false`: a country is outside a classification that makes the distinction.
          hazardous: null,
        }));
    }

    if (enumeration.taxonomy === ENUMERATION_TAXONOMY.NACE) {
      // CAEM Rev.2 is NACE Rev.2 with Moldova's typesetting; both are keyed by the pointed code, and
      // the platform's classifier carries the two authored locales EFRAG does not.
      const named = new Map(
        (this.input.vocabulary.naceClassifierFor(VOCABULARY_COUNTRY) ?? []).map((code) => [code.code, code.labels]),
      );
      return enumeration.members.map((member) => ({
        value: qualify(member.key),
        code: member.code,
        hazardous: member.hazardous,
        label:
          (member.code === null ? undefined : named.get(member.code)?.[this.input.locale]) ??
          member.labels[this.input.locale] ??
          // **Not marked as borrowed, and that is a decision** (spec review, 8 Sep 2026): this
          // fallback is per MEMBER, not per domain — most NACE classes are named in the reader's
          // language and a few are not — so a domain-level note would assert something false about
          // the classification as a whole. A per-member marker is a different mechanism and belongs
          // with whichever task first needs one; `architecture.md` §12.5.6 carries the reasoning.
          member.labels[PUBLISHED_CLASSIFICATION_LOCALE] ??
          null,
      }));
    }

    return enumeration.members.map((member) => ({
      value: qualify(member.key),
      code: member.code,
      hazardous: member.hazardous,
      label: this.input.memberLabels?.[member.key]?.text ?? null,
    }));
  }
}
