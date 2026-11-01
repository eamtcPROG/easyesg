'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import type { ReactNode, RefObject } from 'react';
import styles from '../../styles/entities.module.css';

/**
 * A row collection's frame: the rows as an ordered list, a sentence where there are none, and the add control as the
 * list's last row — the artboard's *Add a site* closing its table (28 Sep 2026). In `shared/` because the sites and the
 * boundary both draw it.
 *
 * **Ordered**, because a row's position is what names it before it has a name of its own. **The add control is a
 * secondary button, not a subtle one**, as the artboard draws it: it is the one way the collection grows, and a subtle
 * one read as a link beside a list of bordered rows. Read-only, it is not drawn at all (UX-13) — the rows stay.
 */
export function RowList({
  count,
  empty,
  addLabel,
  addButton,
  readOnly,
  onAddAction,
  children,
}: {
  /** How many rows there are, removed ones included — they still stand on screen. */
  readonly count: number;
  /** What an empty collection says, in the caller's words. */
  readonly empty: string;
  readonly addLabel: string;
  /** Where focus goes when a row that was never saved is removed. */
  readonly addButton: RefObject<HTMLButtonElement | null>;
  readonly readOnly: boolean;
  readonly onAddAction: () => void;
  /** `EditableRow`s and `RemovedRow`s, each its own list item. */
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.rows}>
      {count === 0 ? (
        <p className={`t-body ${styles.rowsEmpty}`}>{empty}</p>
      ) : (
        <ol className={styles.rowList}>{children}</ol>
      )}
      {readOnly ? null : (
        <Button
          ref={addButton}
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          className={styles.addRow}
          onClick={onAddAction}
        >
          {addLabel}
        </Button>
      )}
    </div>
  );
}
