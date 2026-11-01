import type { HistorySubject } from '@/client/history/history-subject';

/**
 * What S-12 is opened on (task 84.2): the subject, and the words naming it under the panel's title — the field's
 * label, the entity's or the organization's name. Its own module so the provider that holds one and the panel that
 * draws one import it rather than each other.
 */
export interface HistoryRequest {
  readonly subject: HistorySubject;
  readonly naming: string;
}
