'use client';

import { SAVE_STATE, SaveStateIndicator } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useAutosaveContext } from './autosave-context';

/**
 * UX-35's indicator, in the shell's one fixed location, reading the screen's own state (task 35.2).
 *
 * The four labels are the catalogue's; the state is the reducer's, derived — so the words here can
 * only ever describe what `saveStateOf` computed, and a "saved" that is not saved has no way to be
 * rendered.
 */
export function SaveState() {
  const t = useTranslations('organization.wizard.saveState');
  const { saveState } = useAutosaveContext();

  return (
    <SaveStateIndicator
      state={saveState}
      regionLabel={t('label')}
      labels={{
        [SAVE_STATE.SAVED]: t('saved'),
        [SAVE_STATE.SAVING]: t('saving'),
        [SAVE_STATE.QUEUED]: t('queued'),
        [SAVE_STATE.FAILED]: t('failed'),
      }}
    />
  );
}
