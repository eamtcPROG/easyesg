import { getFormatter, getTranslations } from 'next-intl/server';
import { calendarDayOf } from '@/lib/legal-date';
import { ATTENTION_CONCERN, ATTENTION_TONE_OF, type FilingConcern } from '../../../tools/attention';
import type { OverviewRow } from '../../../tools/overview';
import { FilingAction } from '../shared/filing-action';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { AttentionItem } from './attention-item';

/**
 * A filing on the attention list, worded for what it asks (task 255) — the artboard's *Two figures in B3 contradict
 * each other* shape, told from what the overview reads: a passed deadline, answers needing a fix, a period with no
 * report, work in progress, a report ready to file.
 *
 * **The title names the entity and the year**, since an organization filing for several entities reads one list
 * (the multi-entity artboard's *Brutăria Lina SRL · …*); **the body says why it matters and when it is due**, the due
 * date in the period's own words and never reformatted into an instant (NFR-34). A passed deadline carries its date in
 * the title instead, which is the fact the item exists to state.
 */
export async function AttentionFiling({
  concern,
  row,
  canWrite,
}: {
  readonly concern: FilingConcern;
  readonly row: OverviewRow;
  readonly canWrite: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations(`${OVERVIEW_MESSAGES}.attention.filing`), getFormatter()]);

  const entity = row.entityName;
  // **A string, because ICU formats a bare number** — `2026` as a number renders "2 026" in `ro` and `ru`.
  const year = String(row.fiscalYear);
  const dueDate = row.due === null ? null : format.dateTime(calendarDayOf(row.due), 'calendar');
  const due = dueDate === null ? t('dueNone') : t('due', { date: dueDate });
  const validation = row.validation;

  const words = ((): { readonly title: string; readonly body: string } => {
    switch (concern) {
      case ATTENTION_CONCERN.OVERDUE:
        return { title: t('overdue.title', { entity, year, date: dueDate ?? '' }), body: t('overdue.body') };
      case ATTENTION_CONCERN.FINDINGS:
        return {
          title: t('findings.title', { entity, year, count: validation?.outstanding ?? 0 }),
          body: `${t('findings.body')} ${due}`,
        };
      case ATTENTION_CONCERN.NOT_STARTED:
        return { title: t('not_started.title', { entity, year }), body: `${t('not_started.body')} ${due}` };
      case ATTENTION_CONCERN.IN_PROGRESS:
        return {
          title: t('in_progress.title', { entity, year }),
          body: `${
            validation === null
              ? t('in_progress.bodyUnchecked')
              : t('in_progress.body', { done: validation.modulesComplete, counted: validation.modulesCounted })
          } ${due}`,
        };
      case ATTENTION_CONCERN.READY_TO_FILE:
        return { title: t('ready_to_file.title', { entity, year }), body: `${t('ready_to_file.body')} ${due}` };
    }
  })();

  return (
    <AttentionItem
      tone={ATTENTION_TONE_OF[concern]}
      title={words.title}
      action={<FilingAction row={row} canWrite={canWrite} />}
    >
      {words.body}
    </AttentionItem>
  );
}
