import type { Clock } from '@api/contracts/clock.port';
import type { Locale } from '@easyesg/i18n';
import { setLocales } from '../domain/content-console';
import { ContentDraftMissingError, ContentSignOffMissingError } from '../errors/content.errors';
import type { ContentConsoleStore, ContentSignOff } from '../interfaces/content-console-store.interface';
import { CONTENT_DRAFT_STATE, type ContentItemRef } from '../models/content-console.model';

export interface PublishContentSetCommand {
  readonly items: readonly ContentItemRef[];
  /** The locales the operator signs off — every locale any item carries (NFR-23; 182/37). */
  readonly signedOff: readonly Locale[];
  readonly operatorId: string;
}

/**
 * UC-72 (task 67.5; FR-62): a reviewed set published by one transaction, the sign-off of each locale recorded on the
 * publication. **Every locale any item carries must be signed off** — the English and Russian texts are separately
 * authored and signed off, never machine-translated (NFR-23, FR-63 AC-3) — so a set that would put a locale live no one
 * vouched for is refused before anything is written. The store refuses an item with no draft in review, or one its
 * reader would not read, rolling the whole set back (67.14). Answers the publication's id, which the audit row names.
 */
export class PublishContentSet {
  constructor(
    private readonly store: ContentConsoleStore,
    private readonly now: Clock,
  ) {}

  async execute(command: PublishContentSetCommand): Promise<{ readonly id: string }> {
    const items = await this.store.items();
    const payloads = command.items.map((ref) => {
      const draft = items.find((item) => item.kind === ref.kind && item.key === ref.key)?.draft;
      if (draft?.state !== CONTENT_DRAFT_STATE.IN_REVIEW) throw new ContentDraftMissingError();
      return draft.payload;
    });

    const needed = setLocales(payloads);
    if (needed.some((locale) => !command.signedOff.includes(locale))) throw new ContentSignOffMissingError();

    const at = this.now();
    const signOff: Record<string, ContentSignOff> = Object.fromEntries(
      needed.map((locale) => [locale, { by: command.operatorId, at }]),
    );
    const { publicationId } = await this.store.publishReviewed({
      items: command.items,
      signOff,
      operatorId: command.operatorId,
    });
    return { id: publicationId };
  }
}
