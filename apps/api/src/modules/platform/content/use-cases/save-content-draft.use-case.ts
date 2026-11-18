import { ContentKeyInvalidError } from '../errors/content.errors';
import type { ContentKind } from '../constants/content.constants';
import { isContentKey } from '../domain/content-console';
import type { ContentConsoleStore } from '../interfaces/content-console-store.interface';
import type { ContentDraft } from '../models/content-console.model';

export interface SaveContentDraftCommand {
  readonly kind: ContentKind;
  readonly key: string;
  readonly payload: Record<string, unknown>;
  /** The operator saving it, from the request context. */
  readonly operatorId: string;
}

/**
 * UC-71's edit (task 67.5; FR-61, FR-62 behaviour 7): the item's draft saved — a new item's first, or the one open
 * draft edited, which takes it back from review. **Nothing is live until it is published** (FR-62 AC-1): a draft has no
 * schedule entry. **No refusal of the payload here**, since a half-translated draft is what a draft is for; publication
 * judges it.
 */
export class SaveContentDraft {
  constructor(private readonly store: ContentConsoleStore) {}

  async execute(command: SaveContentDraftCommand): Promise<ContentDraft> {
    if (!isContentKey(command.key)) throw new ContentKeyInvalidError();
    return this.store.saveDraft(command);
  }
}
