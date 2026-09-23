import { Inject, Injectable } from '@nestjs/common';
import { LOCALES, type Locale } from '@easyesg/i18n';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import { NotificationCategoryNotFoundError } from '../errors/notification.errors';
import { CATEGORY_WORDING, type CategoryWording, type RenderedCategoryWording } from '../interfaces/category-wording.interface';
import type { ConsoleCategory, PublicationConsequence } from '../models/category-console.model';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import { ListConsoleCategories } from '../use-cases/list-console-categories.use-case';
import { PreviewCategoryPublication } from '../use-cases/preview-category-publication.use-case';
import { PublishCategory } from '../use-cases/publish-category.use-case';
import { RevertCategory } from '../use-cases/revert-category.use-case';

/**
 * The seam between A-17's controller and its four use cases (task 67.10), and where the ambient values are resolved:
 * **the operator, from the admin session** — the publishing version's `created_by` — **the category, from the path**,
 * narrowed to the vocabulary so an unknown one is a 404 — and **the wording in every locale**, which the catalogue
 * holds and the use cases do not reach.
 */
@Injectable()
export class CategoryConsoleService {
  constructor(
    private readonly listCategories: ListConsoleCategories,
    private readonly previewPublication: PreviewCategoryPublication,
    private readonly publishCategory: PublishCategory,
    private readonly revertCategory: RevertCategory,
    @Inject(CATEGORY_WORDING) private readonly wording: CategoryWording,
  ) {}

  async list(): Promise<readonly { category: ConsoleCategory; wording: readonly RenderedCategoryWording[] }[]> {
    return (await this.listCategories.execute()).map((category) => ({
      category,
      wording: LOCALES.map((locale: Locale) => this.wording.render({ categoryKey: category.categoryKey, locale })),
    }));
  }

  preview(input: FromPath<{ behaviour: NotificationCategoryBehaviour }>): Promise<readonly PublicationConsequence[]> {
    return this.previewPublication.execute({ categoryKey: categoryOf(input.category), behaviour: input.behaviour });
  }

  publish(
    input: FromPath<{ behaviour: NotificationCategoryBehaviour; expectedRevision: number }>,
  ): Promise<{ readonly id: string; readonly revision: number }> {
    return this.publishCategory.execute({
      categoryKey: categoryOf(input.category),
      behaviour: input.behaviour,
      expectedRevision: input.expectedRevision,
      operatorId: requestOperatorId(),
    });
  }

  revert(input: FromPath<{ expectedRevision: number }>): Promise<{ readonly id: string; readonly revision: number }> {
    return this.revertCategory.execute({
      categoryKey: categoryOf(input.category),
      expectedRevision: input.expectedRevision,
      operatorId: requestOperatorId(),
    });
  }
}

type FromPath<T> = T & { readonly category: string };

const categoryOf = (category: string): NotificationCategoryKey => {
  if (!isNotificationCategoryKey(category)) throw new NotificationCategoryNotFoundError();
  return category;
};
