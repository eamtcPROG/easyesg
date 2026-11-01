import { LegalControllerChangedError } from '../errors/legal-controller.errors';
import type {
  LegalControllerPublicationRequest,
  LegalControllerStore,
} from '../interfaces/legal-controller-store.interface';
import type { LegalControllerPublication, StoredLegalController } from '../models/legal-controller.model';

/** What the store answers when nothing was ever published: every field empty, revision 0. */
export const NO_LEGAL_CONTROLLER: StoredLegalController = {
  controller: { registeredName: '', idno: '', registeredAddress: '', dataProtectionEmail: '' },
  revision: 0,
  changedByEmail: null,
  changedAt: null,
};

/**
 * A-21's store, in memory (task 75). **It models the revision check** the configuration publisher makes under its
 * lock — a publication against a revision no longer in force is refused and records nothing — as A-18's fake does.
 */
export class FakeLegalControllerStore implements LegalControllerStore {
  stored: StoredLegalController = NO_LEGAL_CONTROLLER;
  readonly publications: LegalControllerPublicationRequest[] = [];

  read(): Promise<StoredLegalController> {
    return Promise.resolve(this.stored);
  }

  publish(request: LegalControllerPublicationRequest): Promise<LegalControllerPublication> {
    if (this.stored.revision !== request.expectedRevision) return Promise.reject(new LegalControllerChangedError());

    const revision = this.stored.revision + 1;
    this.publications.push(request);
    this.stored = { controller: request.controller, revision, changedByEmail: null, changedAt: null };
    return Promise.resolve({ id: `version-${revision}`, revision });
  }
}
