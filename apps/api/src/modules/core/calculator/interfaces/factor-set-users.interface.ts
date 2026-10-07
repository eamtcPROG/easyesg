import type { FactorSetPin } from '../models/factor-set.model';

/**
 * Which organizations have a run pinned to a factor-set revision (task 37.3) — the one question FR-166's factor
 * notice asks across tenants.
 *
 * **Asked with no organization bound, and answering ids alone.** The adapter reads under the worker's own policy,
 * which holds only while nothing is bound (`architecture.md` §12.5.6's task-37.3/37.4 row (4)); everything else about
 * an organization — its reports, its audience — is read bound to it, through `ReportUpdateAudience`.
 */
export interface FactorSetUsers {
  organizationsUsing(pin: FactorSetPin): Promise<readonly string[]>;
}

export const FACTOR_SET_USERS = Symbol('FACTOR_SET_USERS');
