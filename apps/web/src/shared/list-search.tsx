'use client';

import { BUTTON_VARIANT, Button, TextField } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import styles from './list-search.module.css';

/**
 * A list's text search (task 203.2; `design_spec.md` §4.7, UX-141) — one field, **submitted rather than applied per
 * keystroke**, A-02's reasoning: each submission is a navigation (UX-4), and an address per letter typed would fill the
 * history with searches nobody meant. A search in force is cleared from beside it, not only from the filtered empty
 * state.
 *
 * **Keyed on the value the address holds**, so the field resets when the search changes from outside it — *clear the
 * filters*, a back navigation — rather than keeping a stale draft beside results for another term. What it searches
 * over is the screen's to say, so the label is the caller's (per-caller wording, `apps/web/CLAUDE.md`); the two buttons
 * are every list's.
 *
 * **In `shared/` on its admission test**: S-06, S-13 and S-16 draw it.
 */
export function ListSearch({
  value,
  label,
  onSearchAction,
}: {
  /** The term the address holds, `''` for none. */
  readonly value: string;
  readonly label: string;
  readonly onSearchAction: (term: string) => void;
}) {
  const t = useTranslations('chrome.index.search');

  return (
    <form
      key={value}
      role="search"
      className={styles.search}
      // A React form action, so a submit that beats hydration never falls back to the browser's GET (task 96).
      action={(data) => {
        const typed = data.get('q');
        onSearchAction(typeof typed === 'string' ? typed.trim() : '');
      }}
    >
      <div className={styles.field}>
        <TextField name="q" type="search" label={label} defaultValue={value} />
      </div>
      <Button type="submit" variant={BUTTON_VARIANT.SECONDARY} className={styles.button}>
        {t('submit')}
      </Button>
      {value.length > 0 ? (
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} className={styles.button} onClick={() => onSearchAction('')}>
          {t('clear')}
        </Button>
      ) : null}
    </form>
  );
}
