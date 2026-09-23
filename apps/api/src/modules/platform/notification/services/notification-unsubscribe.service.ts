import { Injectable } from '@nestjs/common';
import { translate } from '@api/app/messages/catalogue';
import { categoryNameKey } from '../domain/category-name-key';
import { requestLocale } from '@api/infrastructure/persistence/request-context';
import type { UnsubscribePreview } from '../models/unsubscribe.model';
import { PreviewUnsubscribe, type UnsubscribeTokenQuery } from '../use-cases/preview-unsubscribe.use-case';
import { Unsubscribe } from '../use-cases/unsubscribe.use-case';

/**
 * The Nest-aware seam between `NotificationUnsubscribeController` and its two use cases (task 52.2.2; FR-169), and
 * where the category the link is about gets its name in the negotiated language — `notification.<category>.name`, the
 * key S-26 and S-27 name it by. There is no session to resolve: the token is the whole of who and what.
 */
@Injectable()
export class NotificationUnsubscribeService {
  constructor(
    private readonly previewUnsubscribe: PreviewUnsubscribe,
    private readonly unsubscribe: Unsubscribe,
  ) {}

  async preview(query: UnsubscribeTokenQuery): Promise<NamedUnsubscribe> {
    return named(await this.previewUnsubscribe.execute(query));
  }

  async switchOff(command: UnsubscribeTokenQuery): Promise<NamedUnsubscribe> {
    return named(await this.unsubscribe.execute(command));
  }
}

export type NamedUnsubscribe = UnsubscribePreview & { readonly categoryName?: string };

const named = (answer: UnsubscribePreview): NamedUnsubscribe =>
  'categoryKey' in answer
    ? { ...answer, categoryName: translate(requestLocale(), categoryNameKey(answer.categoryKey)) }
    : answer;
