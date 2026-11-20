import { ContentDraftMissingError } from '../errors/content.errors';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import type { ContentDraft, ContentItemRef } from '../models/content-console.model';

/** UC-72's first step (task 67.5; 182/37): an item's draft goes to review. Refused where it has no draft to submit. */
export class SubmitContentDraft {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(item: ContentItemRef): Promise<ContentDraft> {
    const submitted = await this.store.submitDraft(item);
    if (submitted === null) throw new ContentDraftMissingError();
    return submitted;
  }
}
