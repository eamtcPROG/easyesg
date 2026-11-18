import type { Clock } from '@api/contracts/clock.port';
import { TaxonomyAdoptionInvalidError, TaxonomyVersionUnknownError } from '../errors/taxonomy-console.errors';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';

export interface AdoptTaxonomyVersionCommand {
  readonly version: string;
  readonly templateVersion: string;
  /** The calendar day a period starting on or after it pins the version — after today, and after the open window's start. */
  readonly from: string;
  readonly expectedRevision: number;
  readonly operatorId: string;
}

/**
 * The adoption schedule changed (task 67.21; FR-66; OQ-45; 182/52) — a registered version, with a template release
 * registered against it, adopted for periods starting on or after a day. **Only forward**: a day after today, so no
 * period already open re-reads its pin (DR-4 — a pin is copied when a period opens and never resolved again), and
 * after the open window's start. **Its compensation is another adoption**, which A-04 says beside the control.
 * Answers the version put in force, which the audit row names.
 */
export class AdoptTaxonomyVersion {
  constructor(
    private readonly store: TaxonomyConsoleStore,
    private readonly now: Clock,
  ) {}

  async execute(command: AdoptTaxonomyVersionCommand): Promise<{ readonly id: string; readonly revision: number }> {
    const state = await this.store.state();
    const registered = state.versions.find((entry) => entry.version === command.version);
    if (registered === undefined || !registered.templateVersions.includes(command.templateVersion)) {
      throw new TaxonomyVersionUnknownError();
    }
    const today = this.now().toISOString().slice(0, 10);
    const open = state.adoption.find((window) => window.validTo === null);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(command.from) ||
      command.from <= today ||
      (open?.validFrom != null && command.from <= open.validFrom)
    ) {
      throw new TaxonomyAdoptionInvalidError();
    }
    return this.store.adopt(command);
  }
}
