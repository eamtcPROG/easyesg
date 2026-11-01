'use client';

import { CHANGE_SOURCE, type ChangeEntry, type ChangeSource } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { ACTOR_KIND, entryActorOf } from '../../../tools/entry-actor';
import { HISTORY_MESSAGES } from '../../shared/history-messages';
import styles from '../../styles/history.module.css';

/**
 * One change (task 84.2; FR-54, UC-47): what it moved from what to what, who made it — themself marked as such, a
 * person since removed marked so (UX-69) — when, and, for a disclosure value, where it came from (§12.5.6's task-84
 * row (4)). **Every value arrives worded** by the api (row (3)); this draws them and words only the frame.
 *
 * **The subject's own change is the entry's headline**, unnamed — a field's panel is titled with the field — and each
 * other change names its field. A side with no value reads as a dash, never as a blank a reader could take for a gap
 * in the list.
 */
export function HistoryEntry({
  entry,
  readerAccountId,
  current,
}: {
  readonly entry: ChangeEntry;
  readonly readerAccountId: string;
  /** The newest entry of a field's history, which holds its answer now. */
  readonly current: boolean;
}) {
  const t = useTranslations(HISTORY_MESSAGES);
  const format = useFormatter();
  const actor = entryActorOf({ actor: entry.actor, readerAccountId });
  const sources: Readonly<Record<ChangeSource, string>> = {
    [CHANGE_SOURCE.TYPED]: t('sources.typed'),
    [CHANGE_SOURCE.CARRIED_FORWARD]: t('sources.carried_forward'),
    [CHANGE_SOURCE.CALCULATED]: t('sources.calculated'),
    [CHANGE_SOURCE.OVERRIDDEN]: t('sources.overridden'),
  };
  const side = (value: string | null) => value ?? t('nothing');
  const change = (from: string | null, to: string | null) => (
    <>
      <span aria-hidden="true">{t('change', { from: side(from), to: side(to) })}</span>
      <span className={styles.assistive}>{t('changeSpoken', { from: side(from), to: side(to) })}</span>
    </>
  );
  const headline = entry.changes.find((each) => each.field === null);
  const named = entry.changes.filter((each) => each.field !== null);
  const at = format.dateTime(new Date(entry.at), 'stamp');

  return (
    <li className={styles.entry}>
      {headline === undefined && !current ? null : (
        <p className={styles.headline}>
          {headline === undefined ? null : <span className={styles.change}>{change(headline.from, headline.to)}</span>}
          {current ? <StatusChip tone={STATUS_TONE.POSITIVE}>{t('current')}</StatusChip> : null}
        </p>
      )}
      {named.length === 0 ? null : (
        <dl className={styles.changes}>
          {named.map((each) => (
            <div key={each.field} className={styles.changeRow}>
              <dt className={styles.field}>{each.field}</dt>
              <dd className={styles.change}>{change(each.from, each.to)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className={styles.person}>
        {actor.kind === ACTOR_KIND.PLATFORM
          ? t('actor.platform')
          : actor.kind === ACTOR_KIND.ERASED
            ? t('actor.erased')
            : actor.you
              ? t('actor.yourself', { name: actor.name })
              : actor.name}
        {actor.kind !== ACTOR_KIND.PLATFORM && actor.removed ? (
          <StatusChip tone={STATUS_TONE.NEUTRAL}>{t('actor.removed')}</StatusChip>
        ) : null}
      </p>
      <p className={`t-caption ${styles.when}`}>
        {entry.source === null ? at : t('when', { at, source: sources[entry.source] })}
      </p>
    </li>
  );
}
