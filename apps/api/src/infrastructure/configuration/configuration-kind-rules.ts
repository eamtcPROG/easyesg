import { EMISSION_FACTOR_SET_CONFIG_KIND, FACTOR_SET_REPLACED } from '@api/modules/core/calculator/constants/calculator.constants';
import { factorSetRefusal } from '@api/modules/core/calculator/domain/factor-set-publication';

/**
 * What a publication asks of a kind beyond writing it (tasks 37.3, 37.4; `architecture.md` §12.5.6's task-37.3/37.4
 * row (1), (2)).
 *
 * **Keyed by kind, and declared here rather than injected**, because the seed loader builds `ConfigurationPublisher`
 * with no container: a rule a module registered at boot would not reach the one path that publishes a factor set
 * until A-05 exists, and a seed that skipped it is how a malformed set would reach a run. The rules themselves are the
 * owning module's — this table only says which kind they bind.
 *
 * - **`refusal`** answers why a payload may not be published, or `null`. Asked before anything is written.
 * - **`replaced`** names the outbox event written, on the publication's own transaction (P-8), when the revision in
 *   force for a slot changes — a publication over an occupied window, or a revert. A publication into an empty window
 *   replaces nothing and announces nothing.
 */
export interface ConfigurationKindRule {
  readonly refusal?: (payload: unknown) => string | null;
  readonly replaced?: string;
}

const RULES: Readonly<Record<string, ConfigurationKindRule>> = {
  [EMISSION_FACTOR_SET_CONFIG_KIND]: { refusal: factorSetRefusal, replaced: FACTOR_SET_REPLACED },
};

/** The kind's rule, or none: most kinds are written as they come and announce nothing. */
export const ruleFor = (kind: string): ConfigurationKindRule => RULES[kind] ?? {};

/**
 * The event `replaced` names: which slot moved, and the revision leaving it for the one entering. Validated by the
 * handler that reads it, as every job payload is.
 */
export interface SlotReplaced {
  readonly scope: string;
  readonly leavingRevision: number;
  readonly enteringRevision: number;
}
