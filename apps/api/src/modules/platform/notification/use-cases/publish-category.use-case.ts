import { publicationRefusal } from '../domain/publication-refusal';
import { sameBehaviour } from '../domain/same-behaviour';
import {
  CATEGORY_UNCHANGED,
  NotificationCategoryNotFoundError,
  NotificationCategoryRefusedError,
  NotificationCategoryUnchangedError,
} from '../errors/notification.errors';
import type { CategoryConsoleStore } from '../interfaces/category-console-store.interface';
import type { CategoryWording } from '../interfaces/category-wording.interface';
import type { ListConsoleCategories } from './list-console-categories.use-case';
import type { CategoryBehaviourCommand } from './preview-category-publication.use-case';

/**
 * UC-176's publication (task 67.10; FR-173, NFR-85; §12.5.6's task-67.10 row) — a category's behaviour put in force
 * against the revision the operator read, in force on every replica within AD-4's interval and on this one at once.
 *
 * **The rules first, then the store**: a behaviour a rule refuses is never written, and one identical to what is in
 * force is refused rather than recorded — the task-67.11 row's reading, so the audit log holds changes and not presses.
 */
export class PublishCategory {
  constructor(
    private readonly categories: ListConsoleCategories,
    private readonly wording: CategoryWording,
    private readonly store: CategoryConsoleStore,
  ) {}

  async execute(
    command: CategoryBehaviourCommand & { readonly expectedRevision: number; readonly operatorId: string },
  ): Promise<{ readonly id: string; readonly revision: number }> {
    const category = (await this.categories.execute()).find((entry) => entry.categoryKey === command.categoryKey);
    if (category === undefined) throw new NotificationCategoryNotFoundError();

    const refusal = publicationRefusal({
      categoryKey: command.categoryKey,
      behaviour: command.behaviour,
      worded: (channel) => this.wording.worded({ categoryKey: command.categoryKey, channel }),
    });
    if (refusal !== null) throw new NotificationCategoryRefusedError(refusal);

    const current = category.inForce?.behaviour ?? null;
    if (current !== null && sameBehaviour(current, command.behaviour)) {
      throw new NotificationCategoryUnchangedError(CATEGORY_UNCHANGED.UNCHANGED);
    }
    return this.store.publish(command);
  }
}

