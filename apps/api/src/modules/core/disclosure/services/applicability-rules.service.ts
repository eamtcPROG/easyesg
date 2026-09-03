import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../constants/disclosure.constants';
import {
  APPLICABILITY_CONDITION,
  type ApplicabilityConditionSpec,
  type ApplicabilityRule,
} from '../models/applicability.model';
import type { ApplicabilityRules } from '../interfaces/applicability-rules.interface';
import { isDecimalText } from '../use-cases/applicability';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string');

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

    const rules = this.read(entry.payload.rules, standard, entry.revision);
    this.cache.set(standard, { revision: entry.revision, rules });
    return rules;
  }

  private read(rules: unknown, standard: string, revision: number): readonly ApplicabilityRule[] {
    if (!Array.isArray(rules)) {
      this.logger.error(
        `Configuration entry ${DISCLOSURE_APPLICABILITY_CONFIG_KIND}/${standard} (revision ` +
          `${revision}) is malformed; every disclosure will be treated as applicable`,
      );
      return [];
    }

    const read: ApplicabilityRule[] = [];
    const dropped: number[] = [];
    rules.forEach((rule, index) => {
      if (!isRecord(rule) || !isNonEmptyStringArray(rule.elements)) {
        dropped.push(index);
        return;
      }
      const condition = this.readCondition(rule.condition);
      if (condition === null) {
        dropped.push(index);
        return;
      }
      read.push({ elements: rule.elements, condition });
    });

    // Dropped and LOGGED, never dropped alone — a fail-soft read is only safe when a gate reads the
    // log, and `disclosure-applicability.artefact.spec.ts` asserts no such line for the shipped file.
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${DISCLOSURE_APPLICABILITY_CONFIG_KIND}/${standard} (revision ` +
          `${revision}) carries ${dropped.length} unreadable rule(s), dropped — the disclosures ` +
          `they govern will be treated as applicable: index ${dropped.join(', ')}`,
      );
    }
    return read;
  }

  /** One condition, narrowed to the three the vocabulary declares; `null` for anything else. */
  private readCondition(condition: unknown): ApplicabilityConditionSpec | null {
    if (!isRecord(condition)) return null;
    switch (condition.kind) {
      case APPLICABILITY_CONDITION.NUMERIC_AT_LEAST:
        // A threshold the comparison cannot read is a malformed rule, not a rule nothing satisfies:
        // dropped here, its elements stay applicable — where treating it as unmet would hide them.
        return typeof condition.elementKey === 'string' && isDecimalText(condition.threshold)
          ? {
              kind: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
              elementKey: condition.elementKey,
              threshold: condition.threshold,
            }
          : null;
      case APPLICABILITY_CONDITION.ANY_ROW_ANSWERED:
        return isNonEmptyStringArray(condition.elementKeys)
          ? { kind: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED, elementKeys: condition.elementKeys }
          : null;
      case APPLICABILITY_CONDITION.MEMBER_WITHIN:
        return typeof condition.elementKey === 'string' && isNonEmptyStringArray(condition.members)
          ? {
              kind: APPLICABILITY_CONDITION.MEMBER_WITHIN,
              elementKey: condition.elementKey,
              members: condition.members,
            }
          : null;
      default:
        return null;
    }
  }
}
