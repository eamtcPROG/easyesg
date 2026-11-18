import { ContentDraftMissingError } from '../errors/content.errors';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import type { ContentItemRef } from '../models/content-console.model';

/**
 * An item's open draft dropped (task 67.5; §12.5.6's task-67.14/67.15 row (3)) — what is in force is untouched. Answers
 * the draft's id, which the route's audit row names; refused where there is none.
 */
export class DiscardContentDraft {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(item: ContentItemRef): Promise<{ readonly id: string }> {
    const id = await this.store.discardDraft(item);
    if (id === null) throw new ContentDraftMissingError();
    return { id };
  }
}
