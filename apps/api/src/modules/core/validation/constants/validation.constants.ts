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

/**
 * The day's sweep of open periods for FR-164's and FR-165's notices (task 51.2) — a job `ScheduleTicker` starts as an
 * outbox row each day, at the slot below, which then schedules one check per period that owes one.
 */
export const REPORT_NOTICE_SWEEP = 'validation.report_notice_sweep';

/** One period's check: a validation run, then the notices it owes (task 51.2). Its own job, so one period's failure retries alone. */
export const REPORT_NOTICE_CHECK = 'validation.report_notice_check';

/**
 * When the sweep runs: **07:00 on Chișinău's wall clock** (§12.5.6's task-51.2 row (1)) — at the start of a working day
 * in the zone every organization the platform serves keeps, so a notice is read in the morning rather than overnight.
 */
export const REPORT_NOTICE_SLOT = { at: '07:00', timezone: 'Europe/Chisinau' } as const;
