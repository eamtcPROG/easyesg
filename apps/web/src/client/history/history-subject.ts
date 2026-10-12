/**
 * What S-12 reads a history of (task 84.2; `architecture.md` §12.5.6's task-84 row (1)) — the organization, one
 * entity, or one disclosure field of a report — and the pass-through address each is read at (row (a)).
 *
 * **Directive-free, as a vocabulary must be**: a `'use client'` module's exports reach a Server Component as client
 * references, so one declared there would be unusable from the server the day a server section names a subject (root
 * `CLAUDE.md`). Today its readers are the three triggers and the panel, all Client Components.
 */
export const HISTORY_SUBJECT = {
  ORGANIZATION: 'organization',
  ENTITY: 'entity',
  VALUE: 'value',
} as const;

export type HistorySubject =
  | { readonly kind: typeof HISTORY_SUBJECT.ORGANIZATION }
  | { readonly kind: typeof HISTORY_SUBJECT.ENTITY; readonly entityId: string }
  | {
      readonly kind: typeof HISTORY_SUBJECT.VALUE;
      readonly reportId: string;
      readonly elementKey: string;
      readonly dimensionKey: string;
      readonly ordinal: number;
    };

const PASS_THROUGH = '/api/v1';

/**
 * The subject's history through the token-attaching pass-through (AD-9) — the field's element in the path, and its
 * dimension and ordinal as the query only where they are not the defaults, so an undimensioned field's address reads
 * as the api documents it.
 */
export function historyPath(subject: HistorySubject): string {
  switch (subject.kind) {
    case HISTORY_SUBJECT.ORGANIZATION:
      return `${PASS_THROUGH}/organization/history`;
    case HISTORY_SUBJECT.ENTITY:
      return `${PASS_THROUGH}/entities/${encodeURIComponent(subject.entityId)}/history`;
    case HISTORY_SUBJECT.VALUE: {
      const path = `${PASS_THROUGH}/reports/${encodeURIComponent(subject.reportId)}/values/${encodeURIComponent(subject.elementKey)}/history`;
      const query = new URLSearchParams();
      if (subject.dimensionKey !== '') query.set('dimensionKey', subject.dimensionKey);
      if (subject.ordinal !== 0) query.set('ordinal', String(subject.ordinal));
      const search = query.toString();
      return search === '' ? path : `${path}?${search}`;
    }
  }
}
