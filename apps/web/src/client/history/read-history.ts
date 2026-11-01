import { readResultList, type ChangeEntry } from '@easyesg/contracts';
import { buildListQuery } from '@/lib/pagination';
import { historyPath, type HistorySubject } from './history-subject';

/** One page of a subject's history, newest first, and how many entries it holds in all. */
export interface HistoryPage {
  readonly entries: readonly ChangeEntry[];
  readonly total: number;
}

/** Entries a page asks for — enough for most fields' whole history at once, few enough to read quickly. */
export const HISTORY_PAGE_SIZE = 20;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The members the panel draws from — checked, never cast: a missing `changes` would draw an empty entry. */
const isEntry = (value: unknown): value is ChangeEntry =>
  isRecord(value) &&
  typeof value.at === 'number' &&
  Array.isArray(value.changes) &&
  (value.actor === null || isRecord(value.actor));

/**
 * A page of a subject's change history from the browser, through the pass-through (task 84.2; UC-47) — read when S-12
 * opens, never before.
 *
 * **It answers the page or `null`, never throws**, the notification panel's reason: the panel draws its own *could not
 * load* state, with a way to try again. An answer this tier cannot read is the same fact as no answer.
 */
export async function readHistory(input: {
  readonly subject: HistorySubject;
  readonly page: number;
  readonly fetch?: typeof fetch;
}): Promise<HistoryPage | null> {
  const send = input.fetch ?? fetch;
  const path = historyPath(input.subject);
  const search = buildListQuery({ page: input.page, onpage: HISTORY_PAGE_SIZE });
  try {
    const response = await send(`${path}${path.includes('?') ? '&' : '?'}${search}`, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const list = readResultList<unknown>(await response.json(), path);
    return list.items.every(isEntry) ? { entries: list.items, total: list.total } : null;
  } catch {
    return null;
  }
}
