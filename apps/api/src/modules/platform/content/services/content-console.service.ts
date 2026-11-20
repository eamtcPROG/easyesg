import { Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import type { ContentKind } from '../constants/content.constants';
import type {
  ContentConsole,
  ContentDraft,
  ContentItemRef,
  ContentPublicationPreview,
} from '../models/content-console.model';
import { DiscardContentDraft } from '../use-cases/discard-content-draft.use-case';
import { ListContentConsole } from '../use-cases/list-content-console.use-case';
import { PreviewContentPublication } from '../use-cases/preview-content-publication.use-case';
import { PublishContentSet } from '../use-cases/publish-content-set.use-case';
import { PublishLocaleRegistration } from '../use-cases/publish-locale-registration.use-case';
import { RevertContentItem } from '../use-cases/revert-content-item.use-case';
import { SaveContentDraft } from '../use-cases/save-content-draft.use-case';
import { SubmitContentDraft } from '../use-cases/submit-content-draft.use-case';

/**
 * A-03's application seam (task 67.5; UC-71 … UC-74) — the operator resolved from the request, never the body, and each
 * route's use case called. **Exported for the admin realm's controller**, as A-17's console service is: the route's
 * guard is `platform/admin`'s, and this module importing that one for it would close a cycle.
 */
@Injectable()
export class ContentConsoleService {
  constructor(
    private readonly listConsole: ListContentConsole,
    private readonly saveDraftUseCase: SaveContentDraft,
    private readonly submitDraftUseCase: SubmitContentDraft,
    private readonly discardDraftUseCase: DiscardContentDraft,
    private readonly previewUseCase: PreviewContentPublication,
    private readonly publishUseCase: PublishContentSet,
    private readonly revertUseCase: RevertContentItem,
    private readonly registrationUseCase: PublishLocaleRegistration,
  ) {}

  console(): Promise<ContentConsole> {
    return this.listConsole.execute();
  }

  saveDraft(input: {
    readonly kind: ContentKind;
    readonly key: string;
    readonly payload: Record<string, unknown>;
  }): Promise<ContentDraft> {
    return this.saveDraftUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }

  submitDraft(item: ContentItemRef): Promise<ContentDraft> {
    return this.submitDraftUseCase.execute(item);
  }

  discardDraft(item: ContentItemRef): Promise<{ readonly id: string }> {
    return this.discardDraftUseCase.execute(item);
  }

  preview(input: { readonly items: readonly ContentItemRef[] }): Promise<ContentPublicationPreview> {
    return this.previewUseCase.execute({ ...input, requesterId: requestOperatorId() });
  }

  publish(input: { readonly items: readonly ContentItemRef[]; readonly signedOff: readonly Locale[] }): Promise<{
    readonly id: string;
  }> {
    return this.publishUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }

  revert(item: ContentItemRef): Promise<{ readonly id: string; readonly revision: number }> {
    return this.revertUseCase.execute(item);
  }

  publishRegistration(input: { readonly codes: readonly string[]; readonly expectedRevision: number }): Promise<{
    readonly id: string;
    readonly revision: number;
  }> {
    return this.registrationUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }
}
