'use client';

import { Fieldset, Select } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Dispatch } from 'react';
import { NO_CHOICE, optionOfSelect, selectValueOf } from '../../../tools/import-choice';
import { IMPORT_EVENT, type ImportEvent } from '../../../tools/import-state';
import { MATCHED_FIELDS, type ImportOption, type MatchedField } from '../../../tools/import-values';
import type { ValueMatch } from '../../../tools/import-view';
import styles from '../../styles/calculator.module.css';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * Each value the source, unit and site columns hold, matched once (task 204.2; FR-211's behaviour 3; `architecture.md`
 * §12.5.6's task-204 row (2)): one select per value, labelled by the value as the sheet writes it, offering the
 * calculator's options and *none of these*. A value the panel could match starts matched; one it could not shows the
 * placeholder until the reporter decides, and its rows are reported meanwhile — an empty select is the honest
 * picture of an undecided value, where a default would be a guess.
 */
export function ImportValueMatches({
  matches,
  options,
  dispatch,
}: {
  readonly matches: Readonly<Record<MatchedField, readonly ValueMatch[]>>;
  readonly options: Readonly<Record<MatchedField, readonly ImportOption[]>>;
  readonly dispatch: Dispatch<ImportEvent>;
}) {
  const t = useTranslations(IMPORT_MESSAGES);
  const asked = MATCHED_FIELDS.filter((field) => matches[field].length > 0);
  if (asked.length === 0) return null;

  return (
    <>
      {asked.map((field) => (
        <Fieldset key={field} legend={t(`values.legend.${field}`)}>
          <p className={styles.importingHelp}>{t('values.help')}</p>
          <div className={styles.importingChoices}>
            {matches[field].map((match) => (
              <Select
                key={match.value}
                label={t('values.value', { value: match.value })}
                placeholder={t('values.choose')}
                // `''` is Radix's placeholder: what an undecided value shows, and never an option's value.
                value={match.decided ? selectValueOf(match.option) : ''}
                onValueChange={(value) =>
                  dispatch({ type: IMPORT_EVENT.VALUE_MATCHED, field, value: match.value, option: optionOfSelect(value) })
                }
                options={[
                  ...options[field].map((option) => ({ value: option.value, label: option.label })),
                  { value: NO_CHOICE, label: t('values.none') },
                ]}
              />
            ))}
          </div>
        </Fieldset>
      ))}
    </>
  );
}
