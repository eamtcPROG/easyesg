import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../constants/disclosure.constants';
import type { ApplicabilityRule } from '../models/applicability.model';
import type { ApplicabilityRules } from '../interfaces/applicability-rules.interface';
import { readApplicabilityRules } from '../domain/applicability-rules-reader';

/**
 * `ApplicabilityRules` over the configuration store — the adapter half of AD-4 for FR-28 and FR-72
 * (task 91.3).
 *
 * **Validated, never cast**, following `OrganizationVocabularyService` and the taxonomy registry: a
 * rule set is data an operator publishes (UC-81), so a payload whose threshold arrived as `"fifty"`
 * must surface as an operator-facing log line rather than as a comparison that is quietly always
 * false.
 *
 * **A malformed payload fails OPEN, and that reverses the vocabulary's direction on purpose.** An
 * unreadable legal-form list refuses a profile save — loud, and in front of the person who can fix
 * it. An unreadable applicability list would instead *hide disclosures*, and nobody can see what
 * they were never shown: the failure would present as a complete-looking report missing a
 * regulatory section. So an unreadable rule is dropped and every element it governed stays
 * applicable, which is the direction of error a reporter can actually notice (§12.5.6, task 91.3).
 *
 * **Cached per configuration revision**, keyed on it, so a publication invalidates the cache with no
 * invalidation logic — a new revision is a new key. Both wizard reads evaluate on every request.
 */
@Injectable()
export class ApplicabilityRulesService implements ApplicabilityRules {
  private readonly logger = new Logger(ApplicabilityRulesService.name);

  private readonly cache = new Map<string, { revision: number; rules: readonly ApplicabilityRule[] }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  rulesFor(query: { readonly standard: string }): readonly ApplicabilityRule[] {
    const { standard } = query;
    const entry = this.configurationStore.get({
      kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
      scope: standard,
    });
    // Nothing registered is not an error: a standard with no conditional disclosures has no rules,
    // and every field applies. It is the same answer a malformed payload gets, for the reason above.
    if (!entry) return [];

    const cached = this.cache.get(standard);
    if (cached !== undefined && cached.revision === entry.revision) return cached.rules;

    const rules = this.read(entry.payload, standard, entry.revision);
    this.cache.set(standard, { revision: entry.revision, rules });
    return rules;
  }

  private read(payload: unknown, standard: string, revision: number): readonly ApplicabilityRule[] {
    const read = readApplicabilityRules(payload);
    if (read === null) {
      this.logger.error(
        `Configuration entry ${DISCLOSURE_APPLICABILITY_CONFIG_KIND}/${standard} (revision ` +
          `${revision}) is malformed; every disclosure will be treated as applicable`,
      );
      return [];
    }
    // Dropped and LOGGED, never dropped alone — a fail-soft read is only safe when a gate reads the
    // log, and `disclosure-applicability.artefact.spec.ts` asserts no such line for the shipped file.
    if (read.dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${DISCLOSURE_APPLICABILITY_CONFIG_KIND}/${standard} (revision ` +
          `${revision}) carries ${read.dropped.length} unreadable rule(s), dropped — the disclosures ` +
          `they govern will be treated as applicable: index ${read.dropped.join(', ')}`,
      );
    }
    return read.rules;
  }
}
