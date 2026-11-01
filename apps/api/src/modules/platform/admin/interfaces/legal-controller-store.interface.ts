import type { LegalController } from '@api/modules/platform/legal/domain/legal-controller';
import type { LegalControllerPublication, StoredLegalController } from '../models/legal-controller.model';

export const LEGAL_CONTROLLER_STORE = Symbol('LEGAL_CONTROLLER_STORE');

export interface LegalControllerPublicationRequest {
  readonly controller: LegalController;
  /** The revision the change was made against; any other in force refuses it with `LegalControllerChangedError`. */
  readonly expectedRevision: number;
  /** The operator publishing — the version's `created_by`, which A-21's attribution line names. */
  readonly operatorId: string;
}

/**
 * A-21's store (task 75): what is in force in the `legal_controller` slot the console publishes into, and the
 * publication. **Read from the store's tables, not its cache** — A-18's reason: who published the version in force,
 * which the cache does not carry, and what is in force *now*, where the cache may be one poll behind.
 */
export interface LegalControllerStore {
  read(): Promise<StoredLegalController>;

  publish(request: LegalControllerPublicationRequest): Promise<LegalControllerPublication>;
}
