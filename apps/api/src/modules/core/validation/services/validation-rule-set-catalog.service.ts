import { Injectable, Logger } from '@nestjs/common';
import { RULE_SET_READ, readRuleSet, type RuleSet } from '@easyesg/validation';
import { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  VALIDATION_RULE_SET_CONFIG_KIND,
  VALIDATION_RULE_SET_CONFIG_SCOPE,
} from '../constants/validation.constants';
import type { RuleSetInForce, ValidationRuleSets } from '../interfaces/validation-rule-sets.interface';

/**
 * The validation rule set in force on a date, or the one a lock pinned, from the configuration store (task 41.1; FR-73
 * items 4, 5 and 9).
 *
 * **Read through the package's own reader**, the one publication refuses through (`ruleSetRefusal`), so a set that
 * reached the store and a set a run evaluates cannot be read two ways. A revision is immutable once published, so its
 * reading is cached per revision with no invalidation; a new publication is a new revision and a new reading — which
 * is what makes *a rule change takes effect with no redeploy* true within the store's poll (AD-4).
 *
 * **It fails closed**, `FactorSetCatalog`'s direction and for a sharper reason: an unreadable set answers no set, said
 * at `error` once per revision, and a run is refused rather than evaluated against nothing — a run with no rules finds
 * nothing, and nothing outstanding reads ready to file (§12.5.6's task-41 row (d)).
 */
@Injectable()
export class ValidationRuleSetCatalog implements ValidationRuleSets {
  private readonly logger = new Logger(ValidationRuleSetCatalog.name);
  private readonly readings = new Map<number, RuleSet | null>();

  constructor(
    private readonly configurationStore: ConfigurationStore,
    private readonly configurationHistory: ConfigurationHistory,
  ) {}

  inForce(query: { readonly on: string }): RuleSetInForce | null {
    const entry = this.configurationStore.get({
      kind: VALIDATION_RULE_SET_CONFIG_KIND,
      scope: VALIDATION_RULE_SET_CONFIG_SCOPE,
      on: query.on,
    });
    if (!entry) {
      this.logger.error(
        `No ${VALIDATION_RULE_SET_CONFIG_KIND}/${VALIDATION_RULE_SET_CONFIG_SCOPE} is in force on ${query.on} — ` +
          'no report can be validated as at that date until one is published',
      );
      return null;
    }
    const ruleSet = this.read(entry.revision, entry.payload);
    return ruleSet === null ? null : { ruleSet, revision: entry.revision };
  }

  async pinned(query: { readonly revision: number }): Promise<RuleSetInForce | null> {
    const cached = this.readings.get(query.revision);
    if (cached !== undefined) return cached === null ? null : { ruleSet: cached, revision: query.revision };
    const version = await this.configurationHistory.version({
      kind: VALIDATION_RULE_SET_CONFIG_KIND,
      scope: VALIDATION_RULE_SET_CONFIG_SCOPE,
      revision: query.revision,
    });
    if (!version) {
      // Not cached: a pin naming nothing is a defect to surface every time it is met, as `FactorSetCatalog` says.
      this.logger.error(
        `No published ${VALIDATION_RULE_SET_CONFIG_KIND}/${VALIDATION_RULE_SET_CONFIG_SCOPE} revision ` +
          `${query.revision} — a locked report pinned to it cannot be validated`,
      );
      return null;
    }
    const ruleSet = this.read(query.revision, version.payload);
    return ruleSet === null ? null : { ruleSet, revision: query.revision };
  }

  private read(revision: number, payload: unknown): RuleSet | null {
    const cached = this.readings.get(revision);
    if (cached !== undefined) return cached;
    const reading = readRuleSet(payload);
    const ruleSet = reading.outcome === RULE_SET_READ.READ ? reading.ruleSet : null;
    if (reading.outcome === RULE_SET_READ.REFUSED) {
      this.logger.error(
        `Configuration entry ${VALIDATION_RULE_SET_CONFIG_KIND}/${VALIDATION_RULE_SET_CONFIG_SCOPE} (revision ` +
          `${revision}) is unreadable — ${reading.problems.map((p) => `${p.id ?? p.index}: ${p.problem}`).join('; ')}; ` +
          'no report can be validated against it until a correction is published',
      );
    }
    this.readings.set(revision, ruleSet);
    return ruleSet;
  }
}
