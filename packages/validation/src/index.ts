/**
 * `@easyesg/validation` — the rule interpreter.
 *
 * Shared between `apps/api` and `apps/web` (architecture.md §9.8): the wizard shows validation inline as the user
 * types (FR-40) and the api evaluates authoritatively when asked — an explicit run, an export request, a notice's
 * schedule (182/26). **One rule interpreter, two execution sites, no drift** — reimplementing the rules client-side
 * for responsiveness is the failure this package exists to prevent, and a corpus run in both runtimes is the proof
 * (task 40.3).
 *
 * The rules themselves are versioned configuration, not code (AD-4, D-G): a rule set is data in a closed set of kinds,
 * each rule naming its verdict and a message key whose wording ships in the catalogues (§12.5.6's task-40 row). The
 * verdicts are FR-40's; `OK` is the absence of a finding, and a value row's own state carries answers only —
 * `nil_return` and `not_available` among them — never a verdict (182/17).
 *
 * Beside the interpreter, the package holds the **password policy** (OQ-51) — moved here in task 20, for the same
 * one-implementation-two-sites reason. See `password-policy.ts`.
 */
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  evaluatePasswordPolicy,
  passwordMeetsPolicy,
  type PasswordPolicyVerdict,
} from './password-policy.js';

/**
 * And FR-16's entity identifiers (task 29.2) — for the same reason again: S-15 validates inline as
 * the Administrator types, the API re-validates in the request that persists, and FR-107's billing
 * fiscal code will be a third caller in a context that shares no code with `core`.
 */
export {
  validateIdno,
  validateLei,
  idnoIsValid,
  leiIsValid,
  type IdentifierVerdict,
} from './entity-identifier.js';

/**
 * And FR-9's name parts (task 185, 182/6): registration, setup and S-27 refuse a part with no visible character in the
 * api, and the three screens say so inline — one verdict, for the same reason again.
 */
export { namePartIsPresent, presentNamePart } from './name-part.js';

/** The rule definition (task 40.1): the vocabulary a rule set is written in, and the reader that admits one. */
export {
  ADMITTED_VERDICTS,
  CONDITION_KIND,
  RELATION,
  RULE_KIND,
  type Condition,
  type ConditionKind,
  type ExclusiveRule,
  type FieldSelector,
  type RangeRule,
  type Relation,
  type RequiredAnyRule,
  type RequiredRule,
  type RowCompleteRule,
  type Rule,
  type RuleKind,
  type RuleSet,
  type SumPart,
  type SumRule,
  type UrlRule,
  type YearOverYearRule,
} from './rules/rule-definition.js';
export {
  RULE_PROBLEM,
  RULE_SET_READ,
  readRuleSet,
  type RuleProblem,
  type RuleProblemCode,
  type RuleSetReading,
} from './rules/read-rule-set.js';

/** The interpreter (task 40.2): answers in, findings out, and the one verdict a field shows. */
export { evaluateRules, type RuleEvaluation } from './rules/evaluate-rules.js';
export type { FieldAddress, FieldValue } from './rules/field-value.js';
export type { Finding } from './rules/finding.js';
export { VERDICT, mostSevereVerdict, type Verdict } from './rules/verdict.js';
