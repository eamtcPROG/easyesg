import { ContentNothingToRevertError } from '../errors/content.errors';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import type { ContentItemRef } from '../models/content-console.model';

/**
 * NFR-85's one step for one item (task 67.5; UC-72; FR-62 AC-3): its previous version put back in force, the rest of
 * the set it was published in left as it stands (182/36). Answers the version put back, which the audit row names.
 */
export class RevertContentItem {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(item: ContentItemRef): Promise<{ readonly id: string; readonly revision: number }> {
    const reverted = await this.store.revert(item);
    if (reverted === null) throw new ContentNothingToRevertError();
    return reverted;
  }
}
