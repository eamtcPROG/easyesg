import type { RuleFamily, RulesSlot } from '../models/rules-console.model';

/**
 * A-05's store (task 67.8) — the three families' slots in force, read from `config.entry_*` directly as A-03's and
 * A-04's are, and a publication into one slot's window against the revision read. **Its adapter maps the store's errors
 * onto this module's refusals**: a payload the family's reader would refuse (tasks 37.4, 41.1, 67.8), and a slot a
 * colleague changed since it was read.
 */
export interface RulesConsoleStore {
  slots(): Promise<readonly RulesSlot[]>;

  publish(input: {
    readonly family: RuleFamily;
    readonly scope: string;
    readonly payload: Record<string, unknown>;
    readonly validFrom: string | null;
    readonly validTo: string | null;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }>;
}

export const RULES_CONSOLE_STORE = Symbol('RULES_CONSOLE_STORE');
