import { BUTTON_VARIANT, Button, TextField } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-02's search (task 67.3): one field, by name or IDNO, submitted rather than applied per keystroke —
 * each submission is a navigation (UX-4), and an address per letter typed would fill the history
 * with searches nobody meant.
 *
 * **Keyed on the value the address holds**, so the field resets when the search changes from outside
 * it — *clear the search* from the filtered empty state, a back navigation — rather than keeping a
 * stale draft beside results for a different term.
 *
 * **A React form `action`, which owns the submit outright** — task 96's rule that every `<form>`
 * carries `method="post"` or an `action`, taken the second way: a search is a navigation, and a POST
 * to a static host that beat hydration would answer 405 for nothing. Its field is a search term, not
 * the credential that rule was written about, and the action never puts it anywhere but this app's URL.
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
    <form
      key={value}
      role="search"
      className="flex items-end gap-[var(--space-3)]"
      action={(data) => {
        const typed = data.get('q');
        onSubmit(typeof typed === 'string' ? typed : '');
      }}
    >
      <TextField
        name="q"
        type="search"
        label={t('label')}
        defaultValue={value}
        className="w-full max-w-[28rem]"
      />
      <Button type="submit" variant={BUTTON_VARIANT.SECONDARY}>
        {t('submit')}
      </Button>
    </form>
  );
}
