'use client';

import { SAVE_STATE, SaveStateIndicator } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { lastSavedAt } from '../../tools/saved-at';
import { useAutosaveContext } from '../providers/autosave-context';
import styles from './save-state.module.css';

/**
 * UX-35's indicator, in the bar's one fixed location, reading the screen's own state (task 35.2).
 *
 * The four labels are the catalogue's; the state is the reducer's, derived — so the words here can only ever describe
 * what `saveStateOf` computed, and a *saved* that is not saved has no way to be rendered.
 *
 * **Since task 179.1 *saved* says when**: *All changes saved · 12:04*, the time of the last answer the api stored —
 * the read's on arrival, then each acknowledged flush's (`saved-at.ts`), never the browser's clock. Formatted in the
 * configured zone on both sides, so the server's render and the hydrated one say the same. **Two lengths**, as the
 * *S-07/S-08 narrow* frame draws them: *Saved 12:04* at `compact`, where the bar has room for little else; the other
 * length is `display: none` there and so neither drawn nor announced.
 */
export function SaveState({ initialSavedAt }: { readonly initialSavedAt: number | null }) {
  const t = useTranslations('organization.wizard.saveState');
  const format = useFormatter();
  const { saveState, state } = useAutosaveContext();
  const at = lastSavedAt({ initial: initialSavedAt, committed: state.committed });
  const time = at === null ? null : format.dateTime(new Date(at), 'clock');

  const saved = (
    <>
      <span className={styles.long}>{time === null ? t('saved') : t('savedAt', { state: t('saved'), time })}</span>
      <span className={styles.short}>
        {time === null ? t('savedShort') : t('savedAt', { state: t('savedShort'), time })}
      </span>
    </>
  );

  return (
    <SaveStateIndicator
      state={saveState}
      regionLabel={t('label')}
      labels={{
        [SAVE_STATE.SAVED]: saved,
        [SAVE_STATE.SAVING]: t('saving'),
        [SAVE_STATE.QUEUED]: t('queued'),
        [SAVE_STATE.FAILED]: t('failed'),
      }}
    />
  );
}
