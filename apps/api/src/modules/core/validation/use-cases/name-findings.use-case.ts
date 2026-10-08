import type { Locale } from '@easyesg/i18n';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { placeFindings } from '../domain/finding-places';
import type { NamedValidation, ValidationReading } from '../models/validation-run.model';

export interface NameFindingsCommand {
  readonly reading: ValidationReading;
  /** The reader's language — the request's, which the service supplies. */
  readonly locale: Locale;
}

/**
 * **A reading's findings, their fields named and placed for the reader** (task 42.2; FR-42, S-08; `architecture.md`
 * §12.5.6's task-42 row (e)) — over the labels of the version the report pins, in the request's locale.
 *
 * **Its own use case rather than a step of the run**, because a run is also the worker's (task 51.2's notice check),
 * which names nothing and has no reader: naming is what an HTTP answer adds, so the request tier composes it after
 * the run or the read, and the run stays the same for every caller.
 */
export class NameFindings {
  constructor(private readonly labels: DisclosureLabelResolver) {}

  name(command: NameFindingsCommand): NamedValidation {
    const at = { version: command.reading.taxonomyVersion, locale: command.locale };
    return {
      run: command.reading.run,
      rollUp: command.reading.rollUp,
      findings: placeFindings({
        findings: command.reading.findings,
        placedIn: command.reading.placedIn,
        labels: this.labels.labels(at),
        members: this.labels.memberLabels(at),
      }),
    };
  }
}
