import type { RulesConsoleStore } from '../interfaces/rules-console-store.interface';
import type { RulesSlot } from '../models/rules-console.model';

/** A-05's read (task 67.8): every slot of the three families in force, each with the revision a change is made against. */
export class ReadRulesConsole {
  constructor(private readonly store: RulesConsoleStore) {}

  execute(): Promise<readonly RulesSlot[]> {
    return this.store.slots();
  }
}
