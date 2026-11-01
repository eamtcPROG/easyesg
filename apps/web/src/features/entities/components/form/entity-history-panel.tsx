'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { HISTORY_SUBJECT } from '@/client/history/history-subject';
import { useHistory } from '@/features/history/components/provider/history-context';
import { HistoryLink } from '@/features/history/components/trigger/history-link';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * The record's side column — *Change history*, the way into S-12 for the entity's own fields (task 84; §12.5.6's
 * task-84 row (1); `design_spec.md` S-13's exits): who changed its details, when, and what they were before. Its sites,
 * subsidiaries and periods are not in it, which the row records as waiting for a task of their own.
 *
 * **Drawn only for a reader who may read the trail** — an editor or the Organization Administrator (182/22) — which is
 * the screen's `HistoryScope`'s decision, read here as whether there is a way in at all. Archived included: the
 * history of an entity that can no longer change is still the record of how it came to read as it does.
 */
export function EntityHistoryPanel({ entityId, name }: { readonly entityId: string; readonly name: string }) {
  const t = useTranslations(`${ENTITIES_MESSAGES}.history`);
  const history = useHistory();
  const headingId = useId();
  if (history === null) return null;

  return (
    <section className={styles.sidePanel} aria-labelledby={headingId}>
      <h2 id={headingId} className={`t-heading-3 ${styles.sidePanelTitle}`}>
        {t('panelTitle')}
      </h2>
      <p className={`t-body ${styles.sidePanelBody}`}>{t('body')}</p>
      <HistoryLink request={{ subject: { kind: HISTORY_SUBJECT.ENTITY, entityId }, naming: name }} />
    </section>
  );
}
