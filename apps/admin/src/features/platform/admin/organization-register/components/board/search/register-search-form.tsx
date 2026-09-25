import { BUTTON_VARIANT, Button, TextField } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { FilterBar } from '~/shared/filter-bar';

/**
 * A-02's search (task 67.3): one field, by name or IDNO, submitted rather than applied per keystroke —
 * each submission is a navigation (UX-4), and an address per letter typed would fill the history
 * with searches nobody meant.
 *
 * **In the console's filter row since task 170** (`shared/filter-bar.tsx`), so the field is as wide as
 * any other screen's first filter and the button stands at its height — and a search in force is
 * cleared from beside it, not only from the filtered empty state.
 *
 * **Keyed on the value the address holds**, so the field resets when the search changes from outside
 * it — *clear the search*, a back navigation — rather than keeping a stale draft beside results for a
 * different term. Its field is a search term, and the action never puts it anywhere but this app's URL.
 */
export function RegisterSearchForm({
  value,
  onSubmit,
}: {
  readonly value: string;
  readonly onSubmit: (q: string) => void;
}) {
  const t = useTranslations('platform.organizations.search');

  return (
    <FilterBar
      key={value}
      label={t('region')}
      action={(data) => {
        const typed = data.get('q');
        onSubmit(typeof typed === 'string' ? typed : '');
      }}
      actions={
        <>
          <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
            {t('submit')}
          </Button>
          {value.length > 0 ? (
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onSubmit('')}>
              {t('clear')}
            </Button>
          ) : null}
        </>
      }
    >
      <TextField name="q" type="search" label={t('label')} defaultValue={value} />
    </FilterBar>
  );
}
