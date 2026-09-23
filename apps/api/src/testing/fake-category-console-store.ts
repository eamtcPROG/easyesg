import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import { NotificationCategoryChangedError } from '@api/modules/platform/notification/errors/notification.errors';
import type {
  CategoryConsoleStore,
  CategoryPublicationCommand,
  StoredCategory,
  StoredSwitchOffs,
} from '@api/modules/platform/notification/interfaces/category-console-store.interface';

/**
 * A-17's store in memory (task 67.10), shared by the console's use-case specs. **It models the revision check**, which
 * is the store's one behaviour a use case leans on: a publication against a revision no longer in force is refused as
 * the repository refuses it, so a spec can show a stale screen hears *changed* rather than overwriting.
 */
export class FakeCategoryConsoleStore implements CategoryConsoleStore {
  /** Every revision per category, oldest first — the store's `entry_version`, of which the last is in force. */
  readonly history = new Map<NotificationCategoryKey, { payload: Record<string, unknown>; publishedBy: string | null }[]>();
  readonly counts = new Map<NotificationCategoryKey, StoredSwitchOffs>();
  readonly published: CategoryPublicationCommand[] = [];

  seed(categoryKey: NotificationCategoryKey, ...payloads: Record<string, unknown>[]): this {
    this.history.set(categoryKey, payloads.map((payload) => ({ payload, publishedBy: null })));
    return this;
  }

  inForce(): Promise<readonly StoredCategory[]> {
    return Promise.resolve(
      [...this.history].flatMap(([categoryKey, revisions]) => {
        const last = revisions.at(-1);
        return last === undefined
          ? []
          : [
              {
                categoryKey,
                revision: revisions.length,
                payload: last.payload,
                publishedAt: null,
                publishedBy: last.publishedBy,
                previousPayload: revisions.at(-2)?.payload ?? null,
              },
            ];
      }),
    );
  }

  payloadAt(query: { readonly categoryKey: NotificationCategoryKey; readonly revision: number }) {
    return Promise.resolve(this.history.get(query.categoryKey)?.[query.revision - 1]?.payload ?? null);
  }

  switchOffs(): Promise<ReadonlyMap<NotificationCategoryKey, StoredSwitchOffs>> {
    return Promise.resolve(this.counts);
  }

  publish(command: CategoryPublicationCommand): Promise<{ readonly id: string; readonly revision: number }> {
    const revisions = this.history.get(command.categoryKey) ?? [];
    if (revisions.length !== command.expectedRevision) return Promise.reject(new NotificationCategoryChangedError());
    revisions.push({ payload: { ...command.behaviour }, publishedBy: command.operatorId });
    this.history.set(command.categoryKey, revisions);
    this.published.push(command);
    return Promise.resolve({ id: `version-${command.categoryKey}-${revisions.length}`, revision: revisions.length });
  }
}
