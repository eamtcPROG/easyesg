import {
  CONDITION_KIND,
  ENTITY_FIELD,
  RULE_KIND,
  elementsOf,
  isEntityField,
  type FieldSelector,
  type Rule,
} from '@easyesg/validation';
import { isWordedAsFindingInEveryLocale } from '@api/app/messages/committed-catalogues';
import type { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { VALIDATION_RULE_SET_CONFIG_KIND } from './constants/validation.constants';
import { ruleSetRefusal } from './domain/rule-set-publication';
import { ValidationRuleSetCatalog } from './services/validation-rule-set-catalog.service';

/**
 * The shipped rule set (task 41.1; FR-40, FR-73, 182/24, 182/28), held against what it is written in terms of.
 *
 * `validation-rule-set.vsme.json` is written by hand from the template's status columns, so three things can go wrong
 * with nothing failing at evaluation: **an element key EFRAG renames** — a rule naming an element outside the scope is
 * skipped by design (task-40 row (1)), so a typo would make its check silently never run; **a member no axis or domain
 * declares** — a selector or a condition naming one matches no row, ever; and **a message key no locale words**, which
 * the store refuses at publication but which a seed edit would otherwise meet only at `config:seed`.
 *
 * **A field the entity's record answers is declared by `ENTITY_FIELD`, not by a taxonomy** (task 210; §12.5.6's
 * task-210 row (1)), so it is held to that vocabulary instead — a typo there would make the IDNO's check never run too.
 */
describe('the shipped validation rule set', () => {
  const entries = readSeedEntries();
  const shipped = entries.find((entry) => entry.kind === VALIDATION_RULE_SET_CONFIG_KIND);
  const registry = new TaxonomyRegistryService(seedConfigurationStore(entries));
  const versions = registry.registeredVersions({ standard: TAXONOMY_STANDARD.VSME });
  const inForce = new ValidationRuleSetCatalog(
    seedConfigurationStore(entries),
    // Unread here: the shipped set is read as in force, never by a pin.
    {} as ConfigurationHistory,
  ).inForce({ on: '2027-01-01' });
  const rules: readonly Rule[] = inForce?.ruleSet.rules ?? [];

  it('is read whole by the interpreter’s own reader', () => {
    expect(shipped).toBeDefined();
    expect(rules).toHaveLength((shipped?.payload.rules as unknown[] | undefined)?.length ?? -1);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('is one the configuration store would publish: readable, and every message worded in its three parts in every locale', () => {
    expect(ruleSetRefusal({ payload: shipped?.payload, wordedAsFinding: isWordedAsFindingInEveryLocale })).toBeNull();
  });

  it('requires the entity’s IDNO, which a filing cannot be made without (FR-16 behaviour 6; task 210)', () => {
    expect(rules).toContainEqual(
      expect.objectContaining({ kind: RULE_KIND.REQUIRED, verdict: 'missing', fields: [{ element: ENTITY_FIELD.IDNO }] }),
    );
  });

  it('carries 182/28’s one year-over-year rule at its starting proportion, ±50%', () => {
    const yearOverYear = rules.filter((rule) => rule.kind === RULE_KIND.YEAR_OVER_YEAR);
    expect(yearOverYear).toEqual([expect.objectContaining({ proportion: '0.5' })]);
  });

  it.each(versions)('%s declares every element, member and condition member the rules name', (version) => {
    const taxonomy = registry.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version });
    const elements = new Map((taxonomy?.elements ?? []).map((element) => [element.key, element]));

    for (const rule of rules) {
      for (const key of elementsOf(rule)) expect({ rule: rule.id, key, declared: elements.has(key) || isEntityField(key) }).toEqual({
        rule: rule.id,
        key,
        declared: true,
      });

      for (const selector of selectorsOf(rule).filter((candidate) => candidate.member !== undefined)) {
        const members = (elements.get(selector.element)?.axes ?? []).flatMap((key) => {
          const axis = registry.axis({ standard: TAXONOMY_STANDARD.VSME, version, key });
          return axis === null
            ? []
            : [...(axis.defaultMember === null ? [] : [axis.defaultMember]), ...axis.members.map((member) => member.key)];
        });
        expect({ rule: rule.id, member: selector.member, declared: members.includes(selector.member ?? '') }).toEqual({
          rule: rule.id,
          member: selector.member,
          declared: true,
        });
      }

      const condition = 'when' in rule ? rule.when : undefined;
      if (condition?.kind === CONDITION_KIND.HAS_MEMBER) {
        const domain = elements.get(condition.element)?.domain ?? '';
        const enumeration = taxonomy?.enumerations.find((candidate) => candidate.key.endsWith(`:${domain}`));
        const members = (enumeration?.members ?? []).map((member) => member.key);
        expect({ rule: rule.id, member: condition.member, declared: members.includes(condition.member) }).toEqual({
          rule: rule.id,
          member: condition.member,
          declared: true,
        });
      }
    }
  });
});

/** Every field a rule names by element and optional member — the selectors whose member must exist. */
function selectorsOf(rule: Rule): readonly FieldSelector[] {
  switch (rule.kind) {
    case RULE_KIND.REQUIRED:
    case RULE_KIND.REQUIRED_ANY:
    case RULE_KIND.RANGE:
    case RULE_KIND.URL:
      return rule.fields;
    case RULE_KIND.SUM:
      return [...rule.parts, rule.total];
    case RULE_KIND.ROW_COMPLETE:
    case RULE_KIND.EXCLUSIVE:
    case RULE_KIND.YEAR_OVER_YEAR:
      return [];
  }
}
