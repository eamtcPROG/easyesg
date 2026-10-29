'use client';

import type { DisclosureField, DisclosureTarget } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { formatShare } from '@/lib/figure-format';
import { answersHeld, servedAnswers } from '../../../tools/answers-held';
import { targetChanges, targetFigures } from '../../../tools/target-changes';
import { useAutosaveContext } from '../../providers/autosave-context';
import { GROUP_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';

/**
 * **C3's two worked-out changes beneath one emission's three years** (task 79.3; UC-185 step 3; `architecture.md`
 * §12.5.6's task-79.3 row (2)) — the change the target seeks and the change so far, each from the base year.
 *
 * **From the answers the wizard holds now**, so a line moves the moment a figure leaves its field (UX-34) rather than
 * at the next read: S-07 overlays acknowledged writes without re-reading the step, and a change the step read worked
 * out would trail the reporter's typing. A client part for that reason — it reads the autosave queue, as a field's
 * own marker does. Shown, never stored: neither change is a disclosure, and nothing here writes.
 *
 * **Nothing at all where neither can be worked out** — no base year figure, or a base of zero — since a line saying
 * there is no change to show would read as a change of nothing (UC-185 3a).
 */
export function TargetChanges({
  elementKey,
  target,
  fields,
  readOnly,
}: {
  readonly elementKey: string;
  /** Which member is the base year and which the target, as the step names them. */
  readonly target: DisclosureTarget;
  /** The emission's rows — the reporting year's, the base year's and the target year's. */
  readonly fields: readonly DisclosureField[];
  readonly readOnly: boolean;
}) {
  const t = useTranslations(GROUP_MESSAGES);
  const format = useFormatter();
  const { state } = useAutosaveContext();
  const held = answersHeld({ served: servedAnswers({ fields, readOnly }), state });
  const { sought, sinceBase } = targetChanges(targetFigures({ elementKey, target, held }));
  if (sought === null && sinceBase === null) return null;

  const words = (change: string) => formatShare({ value: change, places: CHANGE_PLACES, format });
  return (
    <div className={styles.targetChanges}>
      {sought === null ? null : <p className={styles.targetChange}>{t('targetSought', { change: words(sought) })}</p>}
      {sinceBase === null ? null : (
        <p className={styles.targetChange}>{t('targetSoFar', { change: words(sinceBase) })}</p>
      )}
    </div>
  );
}

/** Two decimals of the percent — how S-07 shows every share (task 211; `design_spec.md` S-07's amendment of that day). */
const CHANGE_PLACES = 2;
