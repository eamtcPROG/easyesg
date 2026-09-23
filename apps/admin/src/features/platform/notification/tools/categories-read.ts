import {
  API_OUTCOME,
  type ApiOutcome,
  type ConsoleCategory,
  type ListResult,
  type NotificationCategoryKey,
} from '@easyesg/contracts';
import { REALM_READ, realmReadFailureOf, type RealmReadFailure } from '~/realm/tools/realm-read';

/**
 * A-17's read, as the arm its section draws (task 67.10). The categories are read whole — every category the release
 * raises, with nothing to page.
 */
export type CategoriesRead =
  | { readonly kind: typeof REALM_READ.READY; readonly categories: readonly ConsoleCategory[] }
  | RealmReadFailure;

export const readCategoriesOutcome = (outcome: ApiOutcome<ListResult<ConsoleCategory>>): CategoriesRead =>
  outcome.status === API_OUTCOME.Ok
    ? { kind: REALM_READ.READY, categories: outcome.value.items }
    : realmReadFailureOf(outcome);

/** One category from the read, or null — the open record, a confirmation's subject. */
export const categoryNamed = (input: {
  readonly categories: readonly ConsoleCategory[];
  readonly categoryKey: NotificationCategoryKey | null | undefined;
}): ConsoleCategory | null => input.categories.find((entry) => entry.categoryKey === input.categoryKey) ?? null;
