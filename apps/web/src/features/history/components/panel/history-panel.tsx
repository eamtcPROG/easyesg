'use client';

import { useReturnFocus } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { HISTORY_SUBJECT } from '@/client/history/history-subject';
import { HistoryEntries } from '../entries/section/history-entries';
import type { HistoryRequest } from '../../tools/history-request';
import { HISTORY_MESSAGES } from '../shared/history-messages';
import styles from '../styles/history.module.css';

/**
 * S-12, the Panel (task 84.2; §4.6; `design_spec.md` S-12; §12.5.6's task-84 row (f)): a non-modal panel at the
 * window's end, a full-screen sheet at `compact` — **dismissible, non-modal, retains position**. The page beside it
 * stays live: a press there does not close it, and a field's history opened while it is open moves it to that field.
 * Escape and the close control close it, and focus returns to what opened it (UX-113).
 *
 * **A Radix Dialog with `modal={false}`** rather than a hand-rolled panel, for what one gets wrong alone — the
 * dialog's name, Escape, focus moved in and handed back — the notification panel's reason for its Popover. The focus
 * hand-back is `useReturnFocus`, since the panel is opened from state and Radix's own trigger ref is empty.
 *
 * States (§8.1, the applicable subset): closed · open, with the entries' own arms inside (`entries/`) · read-only by
 * nature — nothing here writes (no restore: §12.5.6's task-84 row (2)).
 */
export function HistoryPanel({
  request,
  onClose,
  organizationId,
  readerAccountId,
}: {
  readonly request: HistoryRequest | null;
  readonly onClose: () => void;
  readonly organizationId: string;
  readonly readerAccountId: string;
}) {
  const t = useTranslations(HISTORY_MESSAGES);
  const returnFocus = useReturnFocus({});

  return (
    <Dialog.Root
      open={request !== null}
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          className={styles.panel}
          aria-describedby={undefined}
          // Non-modal: the reader works in the page beside it, so a press there leaves it open.
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <div className={styles.head}>
            <div className={styles.heading}>
              <Dialog.Title className={`t-heading-3 ${styles.title}`}>{t('title')}</Dialog.Title>
              {request === null ? null : <p className={`t-caption ${styles.naming}`}>{request.naming}</p>}
            </div>
            <Dialog.Close className={styles.close}>{t('close')}</Dialog.Close>
          </div>
          {request === null ? null : (
            <HistoryEntries
              // A new subject is a new list: its pages and its earlier pages start again.
              key={JSON.stringify(request.subject)}
              subject={request.subject}
              organizationId={organizationId}
              readerAccountId={readerAccountId}
              markCurrent={request.subject.kind === HISTORY_SUBJECT.VALUE}
            />
          )}
          <p className={`t-caption ${styles.note}`}>{t('note')}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
