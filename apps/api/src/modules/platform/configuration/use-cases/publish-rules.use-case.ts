import type { RulesConsoleStore } from '../interfaces/rules-console-store.interface';
import type { RuleFamily } from '../models/rules-console.model';

export interface PublishRulesCommand {
  readonly family: RuleFamily;
  readonly scope: string;
  readonly payload: Record<string, unknown>;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly expectedRevision: number;
  readonly operatorId: string;
}

/**
 * UC-80 … UC-82's publication (task 67.8; FR-71 … FR-74; AD-4): a family's payload put in force for its window, with no
 * redeploy. **What follows a publication is the store's, not this use case's**: a factor set replaced in its window is
 * announced to 37.3's notice and a threshold change to 67.8's, both by `ConfigurationPublisher` on the same transaction;
 * existing calculator runs keep the set they were computed under (FR-35, FR-71), so nothing filed is restated.
 */
export class PublishRules {
  constructor(private readonly store: RulesConsoleStore) {}

  execute(command: PublishRulesCommand): Promise<{ readonly id: string; readonly revision: number }> {
    return this.store.publish(command);
  }
}
