import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { readNotificationCategory } from '../domain/notification-category';
import { CATEGORY_UNCHANGED, NotificationCategoryChangedError, NotificationCategoryUnchangedError } from '../errors/notification.errors';
import type { CategoryConsoleStore } from '../interfaces/category-console-store.interface';
import type { ListConsoleCategories } from './list-console-categories.use-case';
import type { PublishCategory } from './publish-category.use-case';

/**
 * UX-123's one-step revert for a category (task 67.10; NFR-85; §12.5.6's task-67.10 row): the behaviour of the revision
 * before the one in force, **republished** rather than a pointer moved back — so it carries the revision the operator
 * read, is attributed to them in the version and in A-08's log, meets every rule a publication meets, and a second
 * revert undoes the first.
 */
export class RevertCategory {
  constructor(
    private readonly categories: ListConsoleCategories,
    private readonly store: CategoryConsoleStore,
    private readonly publish: PublishCategory,
  ) {}

  async execute(command: {
    readonly categoryKey: NotificationCategoryKey;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    const category = (await this.categories.execute()).find((entry) => entry.categoryKey === command.categoryKey);
    const inForce = category?.inForce ?? null;
    // Checked before the previous revision is read, so a stale screen hears *changed* rather than a revert of the
    // revision someone else put in force.
    if (inForce !== null && inForce.revision !== command.expectedRevision) throw new NotificationCategoryChangedError();
    if (inForce?.previousRevision == null) throw new NotificationCategoryUnchangedError(CATEGORY_UNCHANGED.NOTHING_TO_REVERT);

    const payload = await this.store.payloadAt({ categoryKey: command.categoryKey, revision: inForce.previousRevision });
    const behaviour = payload === null ? null : readNotificationCategory(payload);
    if (behaviour === null) throw new NotificationCategoryUnchangedError(CATEGORY_UNCHANGED.NOTHING_TO_REVERT);

    return this.publish.execute({ ...command, behaviour });
  }
}
