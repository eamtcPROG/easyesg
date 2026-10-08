import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';

/**
 * Where the validation rule set lives in the configuration store (task 41.1; FR-73, AD-4) — seeded from
 * `config/seed/validation-rule-set.vsme.json`, the loader turning the filename's dashes into underscores.
 *
 * **Scoped by the standard**, as the applicability artefact is (§12.5.6's task-41 row (a)): the rules are the
 * template's checks on VSME's elements, and one set serves every registered taxonomy version — a rule naming an
 * element a version lacks is outside the evaluation's scope and is not run (task-40 row (1)).
 */
export const VALIDATION_RULE_SET_CONFIG_KIND = 'validation_rule_set';

export const VALIDATION_RULE_SET_CONFIG_SCOPE = TAXONOMY_STANDARD.VSME;
