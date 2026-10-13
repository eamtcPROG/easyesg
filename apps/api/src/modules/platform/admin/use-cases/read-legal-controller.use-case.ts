import type { LegalControllerStore } from '../interfaces/legal-controller-store.interface';
import type { StoredLegalController } from '../models/legal-controller.model';

/**
 * A-21's reading (task 75; FR-205): the platform operator the legal documents name, the revision a change is made
 * against, and who last changed it. **Answered when nothing was ever published**, with every field empty and revision
 * 0, because publishing the first controller is what the screen is for.
 */
export class ReadLegalController {
  constructor(private readonly store: LegalControllerStore) {}

  execute(): Promise<StoredLegalController> {
    return this.store.read();
  }
}
