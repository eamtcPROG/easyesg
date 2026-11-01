import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { publicationConsequences } from '../domain/publication-consequences';
import { publicationRefusal } from '../domain/publication-refusal';
import { NotificationCategoryNotFoundError, NotificationCategoryRefusedError } from '../errors/notification.errors';
import type { CategoryWording } from '../interfaces/category-wording.interface';
import type { PublicationConsequence } from '../models/category-console.model';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import type { ListConsoleCategories } from './list-console-categories.use-case';

/**
 * UX-123's scope disclosure for a category (task 67.10; §12.5.6's task-67.10 row (2)): what publishing a behaviour
 * would change for recipients, before anything is published — refused here, with the same rule a publication would
 * meet, so the confirmation is never offered for a change the api will not make.
 */
export class PreviewCategoryPublication {
  constructor(
    private readonly categories: ListConsoleCategories,
    private readonly wording: CategoryWording,
  ) {}

  async execute(command: CategoryBehaviourCommand): Promise<readonly PublicationConsequence[]> {
    const category = (await this.categories.execute()).find((entry) => entry.categoryKey === command.categoryKey);
    if (category === undefined) throw new NotificationCategoryNotFoundError();

    const refusal = publicationRefusal({
      categoryKey: command.categoryKey,
      behaviour: command.behaviour,
      worded: (channel) => this.wording.worded({ categoryKey: command.categoryKey, channel }),
    });
    if (refusal !== null) throw new NotificationCategoryRefusedError(refusal);

    return publicationConsequences({
      current: category.inForce?.behaviour ?? null,
      proposed: command.behaviour,
      switchOffs: category.switchOffs,
    });
  }
}

/** A behaviour proposed for one category — the preview's and the publication's shared input. */
export interface CategoryBehaviourCommand {
  readonly categoryKey: NotificationCategoryKey;
  readonly behaviour: NotificationCategoryBehaviour;
}
