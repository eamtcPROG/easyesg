import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ConsoleCategory, type NotificationCategoryKey } from '@easyesg/contracts';
import { useCallback, useId, useReducer } from 'react';
import { useTranslations } from 'use-intl';
import {
  NOTIFICATION_CATEGORIES_QUERY_KEY,
  previewCategoryAction,
  runCategoryAction,
} from '../../../queries/notification-categories';
import { categoryNamed } from '../../../tools/categories-read';
import {
  CATEGORY_ACTION_EVENT,
  INITIAL_CATEGORY_ACTION_STATE,
  categoryActionReducer,
  isBusy,
  revertActionOf,
  type CategoryAction,
} from '../../../tools/category-action-state';
import { withCategory, type NotificationCategoriesSearch } from '../../../tools/notification-categories-search';
import { CategoryConfirmation } from '../confirm/category-confirmation';
import { CategoryList } from '../list/category-list';
import { CategoryNotice } from '../notice/category-notice';
import { CategoryRecord } from '../record/category-record';

/**
 * A-17's categories, ready (task 67.10) — the heading, the notice, the list at full width, the chosen category's record
 * in a dialogue over it (task 170; `design_spec.md` §5.2's preamble), and UX-123's disclosure before anything is
 * published, which opens over the dialogue when the record asked for it.
 *
 * **Every step goes through the api**: a proposal is previewed there, which refuses what code forbids before anything
 * is asked of the operator, and only a confirmed disclosure is written. **Every write's answer invalidates the
 * categories**, the refusals included: a publication refused because a colleague published first must redraw the
 * record with what is now in force, which is what the conflict notice says the operator is looking at.
 *
 * **One notice, drawn where the operator is looking**: inside the record's dialogue while it is open, since the page
 * behind a modal dialogue is hidden from assistive technology, and on the board otherwise — after a row's revert, or
 * once the dialogue is closed.
 *
 * **`onOpen` and `propose` are memoised**, because the list's columns are memoised on them since the row's menu offers
 * the revert (task 170); `mutate` is stable, so `propose` never changes. The rest reach plain buttons that observe no
 * identity (`reactCompiler` is off, AD-9).
 */
export function CategoriesBoard({
  categories,
  search,
  onSearchChange,
}: {
  readonly categories: readonly ConsoleCategory[];
  readonly search: NotificationCategoriesSearch;
  readonly onSearchChange: (next: NotificationCategoriesSearch) => void;
}) {
  const t = useTranslations('platform.notificationCategories');
  const titleId = useId();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(categoryActionReducer, INITIAL_CATEGORY_ACTION_STATE);
  const { mutate: preview } = useMutation({ mutationFn: previewCategoryAction });
  const { mutate: run } = useMutation({ mutationFn: runCategoryAction });

  const propose = useCallback(
    (action: CategoryAction) => {
      dispatch({ type: CATEGORY_ACTION_EVENT.PREVIEW_STARTED, action });
      preview(action, {
        onSuccess: (outcome) =>
          dispatch(
            outcome.status === API_OUTCOME.Ok
              ? { type: CATEGORY_ACTION_EVENT.PREVIEWED, consequences: outcome.value.consequences }
              : { type: CATEGORY_ACTION_EVENT.REFUSED, failure: outcome },
          ),
      });
    },
    [preview],
  );

  const confirm = () => {
    if (state.confirming === null) return;
    const { action } = state.confirming;
    dispatch({ type: CATEGORY_ACTION_EVENT.STARTED });
    run(action, {
      onSuccess: (outcome) => {
        dispatch(
          outcome.status === API_OUTCOME.Ok
            ? { type: CATEGORY_ACTION_EVENT.SUCCEEDED }
            : { type: CATEGORY_ACTION_EVENT.REFUSED, failure: outcome },
        );
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_CATEGORIES_QUERY_KEY });
      },
    });
  };

  const onOpen = useCallback(
    (category: NotificationCategoryKey) => onSearchChange(withCategory(search, category)),
    [onSearchChange, search],
  );

  const selected = categoryNamed({ categories, categoryKey: search.category });
  const busy = isBusy(state);
  const notice = (
    <CategoryNotice
      notice={state.notice}
      onDismiss={() => dispatch({ type: CATEGORY_ACTION_EVENT.NOTICE_DISMISSED })}
      onRevert={(done) => {
        // The category as now read — the publication just made is the revision a revert is made against.
        const category = categoryNamed({ categories, categoryKey: done.action.categoryKey });
        const revert = category === null ? null : revertActionOf(category);
        if (revert !== null) propose(revert);
      }}
    />
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-5)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 id={titleId} className="t-heading-1">
          {t('title')}
        </h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>

      {selected === null ? notice : null}

      <CategoryList categories={categories} busy={busy} onOpen={onOpen} onPreview={propose} />

      {selected === null ? null : (
        <CategoryRecord
          category={selected}
          busy={busy}
          notice={notice}
          onPreview={propose}
          onClose={() => onSearchChange(withCategory(search, null))}
        />
      )}

      <CategoryConfirmation
        confirming={state.confirming}
        busy={state.pending !== null}
        onConfirm={confirm}
        onCancel={() => dispatch({ type: CATEGORY_ACTION_EVENT.CONFIRMATION_CANCELLED })}
      />
    </section>
  );
}
