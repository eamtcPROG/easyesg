'use client';

import { Button, BUTTON_VARIANT, Combobox, type ComboboxOption } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { NaceCodeMatch } from '@easyesg/contracts';
import { searchActivityCodesAction } from '../../actions/actions';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * FR-17's *NACE code(s)* — the classifier's Combobox composed into a list (task 30.4.3).
 *
 * **A screen's arrangement of a control, not a second control.** §11.5 lists Multi-select as its
 * own entry and it stays unbuilt: what an entity needs is *add one, see what you have, remove one*,
 * which is a Combobox plus a list, and building a multi-select to hold three codes would ship an
 * inventory entry whose only consumer already has a simpler answer.
 *
 * **The search is a Server Action, debounced here.** Every keystroke would otherwise be a request
 * against a 996-entry classifier; 250 ms is short enough that the list feels attached to the typing
 * and long enough that a word costs one request rather than seven.
 *
 * **Chosen codes are removed from the offered set.** Adding a code twice is not an error the API
 * would refuse — it would simply store a duplicate — so the control makes it unrepresentable
 * instead of refusing it afterwards.
 *
 * **Its words are its own** (task 158), from the record's `identity` keys, which `IdentitySection`
 * used to resolve and pass in as a `labels` object.
 */
export interface ActivityPickerProps {
  /** The codes the entity holds, with the words for the ones the classifier still carries. */
  readonly chosen: readonly NaceCodeMatch[];
  readonly onChange: (chosen: readonly NaceCodeMatch[]) => void;
}

const DEBOUNCE_MS = 250;

export function ActivityPicker({ chosen, onChange }: ActivityPickerProps) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.identity`);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<readonly NaceCodeMatch[]>([]);
  const [searching, startSearch] = useTransition();
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const search = (next: string): void => {
    setQuery(next);
    if (timer) clearTimeout(timer);
    setTimer(
      setTimeout(() => {
        startSearch(async () => {
          setOptions(await searchActivityCodesAction(next));
        });
      }, DEBOUNCE_MS),
    );
  };

  const held = new Set(chosen.map((match) => match.code));
  const offered: ComboboxOption[] = options
    .filter((match) => !held.has(match.code))
    .map((match) => ({ value: match.code, label: match.label, description: match.code }));

  return (
    <div className={styles.activityPicker}>
      <Combobox
        label={t('activity')}
        help={t('activityHelp')}
        placeholder={t('activityPlaceholder')}
        promptLabel={t('activityPrompt')}
        emptyLabel={t('activityEmpty')}
        loadingLabel={t('activitySearching')}
        loading={searching}
        options={offered}
        // Never holds a value: choosing ADDS to the list below and clears the box, which is what
        // makes this a picker for a set rather than a select with a stale-looking answer in it.
        value=""
        onValueChange={(code) => {
          const match = options.find((option) => option.code === code);
          if (match) onChange([...chosen, match]);
          setQuery('');
          setOptions([]);
        }}
        query={query}
        onQueryChange={search}
      />

      {chosen.length === 0 ? (
        <p className={`t-caption ${styles.sub}`}>{t('activityNone')}</p>
      ) : (
        <ul className={styles.chips}>
          {chosen.map((match) => (
            <li key={match.code} className={styles.chip}>
              <span className={styles.chipCode} translate="no">{match.code}</span>
              <span>{match.label}</span>
              <Button
                type="button"
                variant={BUTTON_VARIANT.SUBTLE}
                aria-label={t('activityRemove', { activity: match.label })}
                onClick={() => onChange(chosen.filter((held) => held.code !== match.code))}
              >
                {/* A word, not a glyph. `lucide-react` is `packages/ui`'s dependency and not this
                    app's — pnpm's strictness is right about that, and importing an icon here to
                    say "remove" would be a dependency for a thing the catalogue already has. The
                    visible word is short and the accessible name carries the activity, so a screen
                    reader hears "remove Manufacture of bread" rather than "remove" three times. */}
                {t('activityRemoveShort')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
