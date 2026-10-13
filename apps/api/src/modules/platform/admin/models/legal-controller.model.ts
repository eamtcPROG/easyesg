import type { LegalController } from '@api/modules/platform/legal/domain/legal-controller';

/**
 * A-21's reading of the platform operator (task 75; FR-205; §12.5.6's task-75 row (7)): the controller the legal
 * documents name, as the slot the console publishes into holds it, and who put it there.
 */
export interface StoredLegalController {
  /**
   * The four facts in force, each as stored — a field the payload does not hold as text reads as empty, so the
   * console shows what there is to correct rather than nothing. Every field is empty where nothing was ever published.
   */
  readonly controller: LegalController;
  /** 0 where nothing has ever been published. */
  readonly revision: number;
  /** The operator who published it — null for the seed, which no operator published. */
  readonly changedByEmail: string | null;
  readonly changedAt: Date | null;
}

/** A configuration version just put in force — its id is what the system audit log names. */
export interface LegalControllerPublication {
  readonly id: string;
  readonly revision: number;
}
