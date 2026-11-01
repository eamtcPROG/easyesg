import {
  type LegalController,
  legalControllerFault,
  legalControllersAreEqual,
  trimmedLegalController,
} from '@api/modules/platform/legal/domain/legal-controller';
import { LegalControllerInvalidError, LegalControllerUnchangedError } from '../errors/legal-controller.errors';
import type { LegalControllerStore } from '../interfaces/legal-controller-store.interface';
import type { LegalControllerPublication } from '../models/legal-controller.model';

export interface PublishLegalControllerCommand extends LegalController {
  /** The revision the operator edited. */
  readonly revision: number;
  readonly operatorId: string;
}

/**
 * A-21's save (task 75; FR-205; §12.5.6's task-75 row (7)): the platform operator the terms of service and the privacy
 * notice name, published as a new revision of the `legal_controller` artefact — on every replica within the store's
 * poll, with no release. **It does not version the documents**: the facts fill places the versioned text leaves for
 * them, and the audit log is the record of the change.
 *
 * Refused, each for a reason an operator can act on: a field the documents could not state — judged by the function
 * the store's own publication rule reads, so the console and the seed cannot disagree; a save identical to what is in
 * force, which the audit log would otherwise record as a change; and a revision no longer in force, which the store
 * refuses so a colleague's save is never silently overwritten.
 */
export class PublishLegalController {
  constructor(private readonly store: LegalControllerStore) {}

  async execute(command: PublishLegalControllerCommand): Promise<LegalControllerPublication> {
    const controller = trimmedLegalController(command);
    const fault = legalControllerFault(controller);
    if (fault !== null) throw new LegalControllerInvalidError(fault);

    const current = await this.store.read();
    if (legalControllersAreEqual({ a: current.controller, b: controller })) {
      throw new LegalControllerUnchangedError();
    }

    return this.store.publish({ controller, expectedRevision: command.revision, operatorId: command.operatorId });
  }
}
